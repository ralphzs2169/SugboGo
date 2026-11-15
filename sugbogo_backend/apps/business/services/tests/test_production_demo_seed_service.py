import json
from datetime import time
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.business.services.production_demo_profile_service import (
    ProductionDemoProfileService,
)
from apps.business.services.production_demo_seed_service import (
    DOMAIN,
    LISTINGS,
    MARKER,
    ProductionDemoSeedService,
)
from apps.business.services.tests.test_development_business_seed_service import (
    DevelopmentSeedTestMixin,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.notifications.models import Notification
from apps.merchant_operations.business_profile.serializers.business_profile_serializers import (
    BusinessInformationSerializer,
)
from apps.reviews.models import BusinessRating, Review, ReviewRatingResult, ReviewSentimentShadow
from apps.reviews.serializers.business_rating_serializers import BusinessRatingSerializer
from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService
from apps.shared.services.gemini_structured_service import GeminiStructuredService
from apps.users.models import ReputationEvent, User


@override_settings(DEBUG=False)
class ProductionDemoSeedServiceTests(DevelopmentSeedTestMixin, TestCase):
    """Exercise real GIS/ORM writes while isolating the external visibility store."""

    @classmethod
    def setUpTestData(cls):
        cls.prepare_seed_prerequisites()

    def setUp(self):
        metrics_patch = patch.object(
            VisibilityEventService,
            "get_recent_visibility_metrics",
            return_value={},
        )
        self.metrics = metrics_patch.start()
        self.addCleanup(metrics_patch.stop)

    @staticmethod
    def apply_seed():
        return ProductionDemoSeedService.run(
            apply=True,
            confirm_database=str(connection.settings_dict["NAME"]),
        )

    def test_preview_makes_no_writes_or_visibility_calls(self):
        before = self.record_counts()
        output = StringIO()
        call_command("seed_production_demo", stdout=output)
        self.assertIn("DRY RUN", output.getvalue())
        self.assertEqual(before, self.record_counts())
        self.metrics.assert_not_called()

    def test_apply_requires_exact_database_confirmation(self):
        before = self.record_counts()
        for confirmation in (None, "wrong-database"):
            with self.assertRaises(ValidationError):
                ProductionDemoSeedService.run(
                    apply=True,
                    confirm_database=confirmation,
                )
        self.assertEqual(before, self.record_counts())

    def test_seed_qualifies_five_businesses_without_touching_real_users(self):
        real_user = self.create_user("real-explorer")
        before_user = User.objects.filter(pk=real_user.pk).values().get()
        notifications = Notification.objects.count()
        result = self.apply_seed()
        self.assertEqual(result["created"], 5)
        self.assertEqual(Business.objects.count(), 5)
        self.assertEqual(
            Business.objects.filter(
                DiscoveryFeedService.hidden_gem_eligibility(),
            ).count(),
            5,
        )
        self.assertEqual(
            User.objects.filter(pk=real_user.pk).values().get(),
            before_user,
        )
        self.assertFalse(Review.objects.filter(USER_ID=real_user).exists())
        self.assertFalse(BusinessVouch.objects.filter(USER_ID=real_user).exists())
        self.assertEqual(Notification.objects.count(), notifications)
        self.assertEqual(ReputationEvent.objects.count(), 0)
        for business in Business.objects.all():
            reviews = business.reviews.all()
            self.assertGreaterEqual(reviews.count(), 5)
            self.assertLessEqual(reviews.count(), 10)
            self.assertEqual(business.BUSN_REVIEW_COUNT, reviews.count())
            self.assertEqual(business.BUSN_VOUCH_COUNT, business.vouches.count())
            self.assertEqual(business.specialty_tag_links.count(), 3)
            self.assertFalse(reviews.filter(REVW_SHOW_IN_COMMUNITY=True).exists())
            for review in reviews:
                self.assertIn("DEMO synthetic review", review.REVW_TEXT)
                self.assertEqual(review.USER_ID.USER_ROLE, User.UserRole.EXPLORER)
                self.assertFalse(review.USER_ID.is_staff)
                self.assertFalse(review.USER_ID.is_superuser)
            for link in BusinessSpecialtyTag.objects.filter(BUSN_ID=business):
                self.assertEqual(link.BST_VOUCH_COUNT, result["explorers"])
                self.assertGreaterEqual(link.BST_TAG_SCORE, Decimal("0.90"))
        for account in User.objects.filter(USER_EMAIL__endswith=f"@{DOMAIN}"):
            self.assertFalse(account.has_usable_password())
            self.assertFalse(account.is_staff)
            self.assertFalse(account.is_superuser)
            self.assertEqual(account.USER_REPUTATION, self.configuration.DAC_REPUTATION_BASELINE)
        for call in self.metrics.call_args_list:
            self.assertTrue(call.kwargs["read_only"])

    def test_rerun_preserves_manual_edits_and_all_existing_rows(self):
        self.apply_seed()
        business = Business.objects.first()
        business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        business.save()
        before = self.record_counts()
        timestamps = list(Business.objects.values_list("BUSN_UPDATED_AT", flat=True))
        self.metrics.reset_mock()
        result = self.apply_seed()
        self.assertEqual(result["created"], 0)
        self.assertEqual(result["reused"], 5)
        self.assertEqual(before, self.record_counts())
        self.assertEqual(
            timestamps,
            list(Business.objects.values_list("BUSN_UPDATED_AT", flat=True)),
        )
        self.metrics.assert_not_called()

    def test_late_visibility_failure_rolls_back_entire_dataset(self):
        self.metrics.side_effect = [{}, {}, {}, {}, VisibilityTrackingUnavailable()]
        before = self.record_counts()
        with self.assertRaises(VisibilityTrackingUnavailable):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_failed_threshold_check_rolls_back_entire_dataset(self):
        self.configuration.DAC_HIDDEN_GEM_MIN_VISIBILITY_GAP = Decimal("1")
        self.configuration.save()
        # A single impression makes a target's true visibility gap fall below one.
        self.metrics.side_effect = lambda **kwargs: {
            business_id: {"impression_count": 1}
            for business_id in kwargs["business_ids"]
        }
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "all inserts rolled back"):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_reserved_business_name_collision_preserves_existing_data(self):
        self.create_unrelated_business(name=LISTINGS[0][0])
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "business name conflicts"):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_reserved_account_collision_preserves_existing_user(self):
        User.objects.create_user(
            email=f"explorer-001@{DOMAIN}",
            USER_FNAME="Existing",
            USER_LNAME="Account",
            USER_ROLE=User.UserRole.ADMIN,
            USER_REPUTATION=Decimal("0.2"),
        )
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "Reserved demo accounts"):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_no_boundary_refuses_all_writes(self):
        self.boundary.delete()
        before = self.record_counts()
        with self.assertRaises(ValidationError):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_partial_dataset_is_not_repaired(self):
        self.apply_seed()
        Business.objects.first().delete()
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "Reserved demo owner conflicts"):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_impossible_specialty_threshold_is_bounded(self):
        self.configuration.DAC_HIDDEN_GEM_MIN_SPECIALTY_SCORE = Decimal("1")
        self.configuration.save()
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "bounded demo seed"):
            self.apply_seed()
        self.assertEqual(before, self.record_counts())

    def test_command_reports_visibility_failure_without_connection_details(self):
        self.metrics.side_effect = VisibilityTrackingUnavailable()
        with self.assertRaisesMessage(CommandError, "all seed inserts were rolled back"):
            call_command(
                "seed_production_demo",
                apply=True,
                confirm_database=str(connection.settings_dict["NAME"]),
                stdout=StringIO(),
            )

    def test_new_profiles_have_photos_complete_hours_and_valid_information(self):
        result = self.apply_seed()
        self.assertEqual(result["profiles_completed"], 5)
        for business in Business.objects.annotate(
            display_cover_photo_url=display_cover_photo_expression(),
        ):
            self.assertTrue(business.display_cover_photo_url.startswith("https://"))
            self.assertEqual(business.photos.count(), 3)
            self.assertFalse(business.photos.exclude(BPHO_PHOTO_PUBLIC_ID="").exists())
            self.assertEqual(business.operating_hours.count(), 7)
            for hours in business.operating_hours.all():
                self.assertTrue(hours.BOHR_IS_OPEN)
                self.assertEqual(hours.BOHR_OPEN_TIME, time(9))
                self.assertEqual(hours.BOHR_CLOSE_TIME, time(18))
            information = BusinessInformationSerializer(data={
                "description": business.BUSN_DESCRIPTION,
                "contact_number": business.BUSN_CONTACT_NUMBER,
                "business_email": business.BUSN_EMAIL,
                "website": business.BUSN_WEBSITE,
                "access_directions": business.BUSN_ACCESS_DIRECTIONS,
            })
            self.assertTrue(information.is_valid(), information.errors)
            self.assertEqual(business.LOCT_ID.LOCT_POSTAL_CODE, "6000")
            self.assertTrue(BusinessLandmark.objects.filter(
                LOCT_ID=business.LOCT_ID,
                BLMK_IS_ARRIVAL_POINT=True,
            ).exists())

    def test_explicit_enrichment_fills_legacy_gaps_and_preserves_manual_edits(self):
        self.apply_seed()
        business = Business.objects.first()
        BusinessPhoto.objects.filter(BUSN_ID=business).delete()
        Business.objects.filter(pk=business.pk).update(
            BUSN_COVER_PHOTO_URL=None,
            BUSN_EMAIL=None,
            BUSN_CONTACT_NUMBER="DEMO - no phone",
            BUSN_WEBSITE="https://example.com/manually-edited",
        )
        BusinessOperatingHours.objects.filter(
            BUSN_ID=business,
            BOHR_DAY="monday",
        ).delete()
        BusinessOperatingHours.objects.filter(
            BUSN_ID=business,
            BOHR_DAY="tuesday",
        ).update(BOHR_CLOSE_TIME=time(20))
        before_reviews = list(Review.objects.values())
        before_vouches = list(BusinessVouch.objects.values())
        self.metrics.reset_mock()
        result = ProductionDemoSeedService.run(
            apply=True,
            confirm_database=str(connection.settings_dict["NAME"]),
            enrich_existing=True,
        )
        business.refresh_from_db()
        self.assertEqual(result["created"], 0)
        self.assertTrue(business.BUSN_COVER_PHOTO_URL)
        self.assertTrue(business.BUSN_EMAIL)
        self.assertRegex(business.BUSN_CONTACT_NUMBER, r"^09\d{9}$")
        self.assertEqual(business.BUSN_WEBSITE, "https://example.com/manually-edited")
        self.assertEqual(business.photos.count(), 3)
        self.assertEqual(business.operating_hours.count(), 7)
        self.assertEqual(
            business.operating_hours.get(BOHR_DAY="tuesday").BOHR_CLOSE_TIME,
            time(20),
        )
        self.assertEqual(before_reviews, list(Review.objects.values()))
        self.assertEqual(before_vouches, list(BusinessVouch.objects.values()))
        self.metrics.assert_not_called()
        before = self.record_counts()
        timestamps = list(Business.objects.order_by("pk").values_list("BUSN_UPDATED_AT", flat=True))
        ProductionDemoSeedService.run(
            apply=True,
            confirm_database=str(connection.settings_dict["NAME"]),
            enrich_existing=True,
        )
        self.assertEqual(before, self.record_counts())
        self.assertEqual(
            timestamps,
            list(Business.objects.order_by("pk").values_list("BUSN_UPDATED_AT", flat=True)),
        )

    def test_plain_rerun_does_not_enrich_existing_profiles(self):
        self.apply_seed()
        Business.objects.update(BUSN_COVER_PHOTO_URL=None)
        self.apply_seed()
        self.assertFalse(Business.objects.exclude(BUSN_COVER_PHOTO_URL=None).exists())

    def test_enrichment_preview_does_not_update_existing_rows(self):
        self.apply_seed()
        Business.objects.update(BUSN_COVER_PHOTO_URL=None)
        before = list(Business.objects.order_by("pk").values())
        call_command(
            "seed_production_demo",
            dry_run=True,
            enrich_existing=True,
            stdout=StringIO(),
        )
        self.assertEqual(before, list(Business.objects.order_by("pk").values()))

    def test_enrichment_failure_rolls_back_prior_profile_changes(self):
        self.apply_seed()
        Business.objects.update(BUSN_COVER_PHOTO_URL=None)
        before = list(Business.objects.order_by("pk").values())
        complete = ProductionDemoProfileService.complete
        calls = 0

        def fail_last(*args):
            nonlocal calls
            calls += 1
            if calls == 5:
                raise ValidationError("Profile completion failed.")
            return complete(*args)

        with patch.object(ProductionDemoProfileService, "complete", side_effect=fail_last):
            with self.assertRaises(ValidationError):
                ProductionDemoSeedService.run(
                    apply=True,
                    confirm_database=str(connection.settings_dict["NAME"]),
                    enrich_existing=True,
                )
        self.assertEqual(before, list(Business.objects.order_by("pk").values()))

    @override_settings(GEMINI_SENTIMENT_CUTOVER_ENABLED=False)
    def test_disabled_sentiment_refuses_queueing_without_writes(self):
        before = self.record_counts()
        with self.assertRaisesMessage(ValidationError, "--queue-sentiment requires"):
            ProductionDemoSeedService.run(
                apply=True,
                confirm_database=str(connection.settings_dict["NAME"]),
                queue_sentiment=True,
            )
        self.assertEqual(before, self.record_counts())

    @override_settings(
        GEMINI_SENTIMENT_ALL_BUSINESSES=True,
        GEMINI_SENTIMENT_CUTOVER_ENABLED=True,
        GEMINI_API_KEY="test-only-not-a-real-key",
    )
    def test_queueing_scopes_jobs_to_demo_reviews_and_never_fabricates_ratings(self):
        self.apply_seed()
        real_user = self.create_user("real-rating-author")
        real_review = Review.objects.create(
            BUSN_ID=Business.objects.first(),
            USER_ID=real_user,
            REVW_TEXT="A real user's review must not be included in seed queueing.",
        )
        with (
            patch.object(GeminiSentimentShadowService, "dispatch") as dispatch,
            self.captureOnCommitCallbacks(execute=True),
        ):
            result = ProductionDemoSeedService.run(
                apply=True,
                confirm_database=str(connection.settings_dict["NAME"]),
                queue_sentiment=True,
            )
        self.assertEqual(result["sentiment_requested"], 40)
        self.assertEqual(dispatch.call_count, 40)
        self.assertEqual(ReviewSentimentShadow.objects.count(), 40)
        self.assertFalse(ReviewSentimentShadow.objects.filter(REVW_ID=real_review).exists())
        self.assertEqual(ReviewRatingResult.objects.count(), 0)
        self.assertFalse(BusinessRating.objects.filter(BRAT_STATE="ready").exists())

    @override_settings(
        GEMINI_SENTIMENT_ALL_BUSINESSES=True,
        GEMINI_SENTIMENT_CUTOVER_ENABLED=True,
        GEMINI_API_KEY="test-only-not-a-real-key",
    )
    def test_analyzed_demo_cohort_produces_ready_rating_through_real_services(self):
        with patch.object(GeminiSentimentShadowService, "dispatch"):
            result = ProductionDemoSeedService.run(
                apply=True,
                confirm_database=str(connection.settings_dict["NAME"]),
                queue_sentiment=True,
            )
        business_id = result["rows"][0]["business_id"]
        jobs = list(ReviewSentimentShadow.objects.filter(
            REVW_ID__BUSN_ID_id=business_id,
        ).values_list("pk", flat=True))
        response = json.dumps({
            "label": "positive",
            "score": 0.5,
            "eligible": True,
            "reason": "evaluative",
        })
        with (
            patch.object(GeminiStructuredService, "generate", return_value=(response, {})),
            patch("apps.reviews.services.business_rating_work_service.BusinessRatingWorkService.dispatch"),
            self.captureOnCommitCallbacks(execute=True),
        ):
            for job_id in jobs:
                self.assertEqual(GeminiSentimentShadowService.process(job_id), "ready")
        business = Business.objects.select_related("business_rating").get(pk=business_id)
        rating = BusinessRatingSerializer(business).data
        self.assertEqual(rating["state"], "ready")
        self.assertEqual(rating["contributing_review_count"], 6)
        self.assertEqual(rating["value"], 4.0)
