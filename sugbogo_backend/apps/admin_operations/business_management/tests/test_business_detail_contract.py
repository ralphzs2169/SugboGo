"""Protect the Admin detail's authoritative metrics and private, query-loaded contract."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.serializers.manage_business_serializers import (
    AdminBusinessDetailSerializer,
)
from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.business.models import (
    Business,
    BusinessPhoto,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.business.services.pocket_service import PocketService
from apps.merchant_application.models import MerchantApplication, MerchantApplicationIdentity
from apps.reviews.models import (
    BusinessRating,
    BusinessReviewSummary,
    Review,
    ReviewInsightRegeneration,
    ReviewRatingResult,
)
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.review_insight_regeneration_service import (
    ReviewInsightRegenerationService,
)
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.analytics.policy import current_policy, policy_scope
from apps.users.models import User


class AdminBusinessDetailContractTests(SummaryFixtureMixin, APITestCase):
    """Exercise real detail reads without telemetry, inference, or lifecycle mutations."""

    def setUp(self):
        """Create an eligible administrator and a business with three current specialties."""
        self.business = self.create_business()
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.admin = self.make_user("admin", User.UserRole.ADMIN)
        self.client.force_authenticate(self.admin)
        self.url = f"/api/admin/businesses/{self.business.pk}/"
        self.tags = []
        for name in ("Coffee", "Pastries", "Service"):
            tag = SpecialtyTag.objects.create(TAG_NAME=name)
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=self.business,
                TAG_ID=tag,
                BST_VOUCH_COUNT=99,
            )
            self.tags.append(tag)

    @staticmethod
    def make_user(
        name,
        role=User.UserRole.EXPLORER,
    ):
        """Create an active account without invoking account onboarding providers."""
        return User.objects.create_user(
            email=f"detail-{name}@example.com",
            password=None,
            USER_FNAME="Detail",
            USER_LNAME=name,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def detail(self):
        """Return the successful existing detail response envelope's data."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        return response.data["data"]

    def photo(
        self,
        url,
        category=BusinessPhoto.PhotoCategory.STOREFRONT,
    ):
        """Persist gallery originals independently of the preferred display image."""
        return BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=category,
            BPHO_PHOTO_URL=url,
            BPHO_PHOTO_PUBLIC_ID=f"detail-{self.business.photos.count()}",
        )

    def test_preferred_image_cover_storefront_and_no_image(self):
        """Use the shared deterministic fallback while preserving gallery records."""
        self.assertIsNone(self.detail()["cover_photo_url"])
        self.photo("https://example.com/interior.jpg", "interior")
        self.assertIsNone(self.detail()["cover_photo_url"])
        self.photo("")
        first = self.photo("https://example.com/storefront-first.jpg")
        self.photo("https://example.com/storefront-second.jpg")
        for cover in (None, ""):
            Business.objects.filter(pk=self.business.pk).update(
                BUSN_COVER_PHOTO_URL=cover,
            )
            self.assertEqual(self.detail()["cover_photo_url"], first.BPHO_PHOTO_URL)
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_COVER_PHOTO_URL="https://example.com/cover.jpg",
        )
        data = self.detail()
        self.assertEqual(data["cover_photo_url"], "https://example.com/cover.jpg")
        self.assertEqual(len(data["photos"]), 4)
        self.assertEqual(data["photos"][2]["photo_url"], first.BPHO_PHOTO_URL)

    def test_current_vouches_reconcile_and_preserve_raw_history(self):
        """Exclude retired, withdrawn and invalid evidence while retaining advisory findings."""
        author = self.make_user("supporter")
        retired = SpecialtyTag.objects.create(TAG_NAME="Retired")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=retired,
            BST_IS_ACTIVE=False,
        )
        for tag in (*self.tags, retired):
            withdrawn_at = None
            if tag == self.tags[2]:
                withdrawn_at = timezone.now()
            BusinessVouch.objects.create(
                BUSN_ID=self.business,
                USER_ID=author,
                TAG_ID=tag,
                VOUCH_REPUTATION_SNAPSHOT=Decimal("0.2"),
                VOUCH_FLAG_SUSPICIOUS=True,
                VOUCH_EVIDENCE_IS_VALID=tag != self.tags[1],
                VOUCH_WITHDRAWN_AT=withdrawn_at,
            )
        Business.objects.filter(pk=self.business.pk).update(BUSN_VOUCH_COUNT=500)
        data = self.detail()
        self.assertEqual(data["current_specialty_vouch_count"], 1)
        self.assertEqual(data["vouch_count"], 1)
        support = data["current_specialty_support"]
        self.assertEqual(len(support), 3)
        self.assertEqual(sum(row["valid_vouches"] for row in support), 1)
        self.assertEqual(sum(row["distinct_supporters"] for row in support), 1)
        self.assertNotIn(
            retired.pk,
            [
                row["specialty_id"]
                for row in support
            ],
        )
        self.assertEqual(
            sum(
                tag["vouch_count"]
                for tag in data["specialty_tags"]
            ),
            1,
        )
        self.assertTrue(all(
            "icon" in tag
            for tag in data["specialty_tags"]
        ))
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, 500)
        self.assertEqual(self.business.vouches.count(), 4)

    def test_published_count_uses_records_and_keeps_preview_bounded(self):
        """Ignore stale counters and unpublished statuses without requiring a scored result."""
        for index in range(5):
            self.create_review(
                self.business,
                index,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                REVW_SENTIMENT_SCORE=None,
            )
        for index, status in enumerate(("under_review", "rejected", "flagged"), 10):
            self.create_review(self.business, index, REVW_STATUS=status)
        Business.objects.filter(pk=self.business.pk).update(BUSN_REVIEW_COUNT=900)
        data = self.detail()
        self.assertEqual(data["published_review_count"], 5)
        self.assertEqual(data["review_count"], 5)
        self.assertEqual(len(data["latest_reviews"]), 3)
        self.assertTrue(all(
            row["status"] == "published"
            for row in data["latest_reviews"]
        ))
        self.assertEqual(
            [
                row["id"]
                for row in data["latest_reviews"]
            ],
            list(
                self.business.reviews.filter(REVW_STATUS="published")
                .order_by("-REVW_CREATED_AT")
                .values_list("REVW_ID", flat=True)[:3]
            ),
        )

    def test_current_saves_count_accounts_not_memberships_or_events(self):
        """Keep saved suspended businesses and decrement only when the last membership goes."""
        holder = self.make_user("holder")
        first = PocketCollectionService.create_collection(holder, "First")
        second = PocketCollectionService.create_collection(holder, "Second")
        PocketService.replace_memberships(
            holder,
            self.business.pk,
            [first.pk, second.pk],
        )
        PocketService.create_pocket(
            self.business.USER_ID,
            self.business.pk,
        )
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_POCKET_COUNT=700,
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        with patch(
            "apps.business.services.visibility_event_service."
            "VisibilityEventService.get_analytics_totals",
            side_effect=AssertionError("Detail must not query MongoDB."),
        ):
            data = self.detail()
        self.assertEqual(data["current_saved_count"], 2)
        self.assertEqual(data["pocket_count"], 2)
        PocketService.remove_membership(holder, first.pk, self.business.pk)
        self.assertEqual(self.detail()["current_saved_count"], 2)
        PocketService.remove_membership(holder, second.pk, self.business.pk)
        self.assertEqual(self.detail()["current_saved_count"], 1)

    def test_owner_projection_is_private_and_distinguishes_listing_status(self):
        """Return only navigation identity and existing merchant presentation fields."""
        owner = self.business.USER_ID
        owner.USER_STATUS = User.UserStatus.SUSPENDED
        owner.save(update_fields=["USER_STATUS"])
        data = self.detail()
        self.assertEqual(data["status"], "active")
        self.assertEqual(data["owner"]["id"], owner.pk)
        self.assertEqual(data["owner"]["status"], "suspended")
        self.assertEqual(data["owner"]["email"], owner.USER_EMAIL)
        self.assertEqual(
            set(data["owner"]),
            {"id", "status", "name", "email", "avatar_url", "avatar_key"},
        )
        self.client.force_authenticate(owner)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def create_rating(
        self,
        count,
    ):
        """Delegate actual versioned score eligibility and aggregation to the existing service."""
        for index in range(count):
            review = self.create_review(self.business, index)
            ReviewRatingResult.objects.create(
                REVW_ID=review,
                RRSR_SOURCE_TEXT=review.REVW_TEXT,
                RRSR_SCORING_VERSION="admin-detail-test-v1",
                RRSR_SCORE=0.625,
                RRSR_LABEL="positive",
            )
        return BusinessRatingService.recompute(
            self.business.pk,
            "admin-detail-test-v1",
        )

    @override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True)
    def test_ready_rating_reuses_shared_rounding_and_separate_count(self):
        """Expose the same authoritative snapshot as Mobile without performing work on GET."""
        aggregate = self.create_rating(5)
        self.create_review(self.business, 99, REVW_SENTIMENT_SCORE=None)
        with patch.object(
            BusinessRatingService,
            "recompute",
            side_effect=AssertionError("GET must not calculate ratings."),
        ):
            data = self.detail()
        self.assertTrue(data["sentiment_rating_enabled"])
        rating = data["sentiment_rating"]
        self.assertEqual(rating["state"], "ready")
        self.assertEqual(rating["value"], 4.3)
        self.assertEqual(rating["contributing_review_count"], 5)
        self.assertEqual(data["published_review_count"], 6)
        self.assertEqual(rating["scoring_version"], aggregate.BRAT_SCORING_VERSION)
        self.assertEqual(rating["provenance"], "versioned")
        self.assertIsNotNone(rating["computed_at"])
        self.assertTrue(rating["experimental"])

    @override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True)
    def test_rating_insufficient_pending_and_unavailable_are_not_zero(self):
        """Keep insufficient, outstanding and failed snapshots distinct from missing scores."""
        self.assertEqual(self.detail()["sentiment_rating"]["state"], "pending")
        aggregate = self.create_rating(4)
        rating = self.detail()["sentiment_rating"]
        self.assertEqual(rating["state"], "insufficient_data")
        self.assertEqual(rating["contributing_review_count"], 4)
        self.assertIsNone(rating["value"])
        aggregate.BRAT_REQUESTED_REVISION += 1
        aggregate.save()
        rating = self.detail()["sentiment_rating"]
        self.assertEqual(rating["state"], "pending")
        self.assertIsNone(rating["contributing_review_count"])
        aggregate.BRAT_LAST_ERROR = "TimeoutError"
        aggregate.save()
        rating = self.detail()["sentiment_rating"]
        self.assertEqual(rating["state"], "unavailable")
        self.assertIsNone(rating["value"])

    @override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=False)
    def test_disabled_rating_does_not_expose_existing_snapshot(self):
        """Keep explicit feature availability without bypassing Mobile's release flag."""
        self.create_rating(5)
        data = self.detail()
        self.assertFalse(data["sentiment_rating_enabled"])
        self.assertNotIn("sentiment_rating", data)

    def test_insight_processing_states_and_generation_time_are_preserved(self):
        """Read generation freshness and processing states without generating content."""
        generated_at = timezone.now() - timedelta(days=1)
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_GENERATED_AT=generated_at,
            BRSU_KEYWORDS_PROCESSED_AT=timezone.now(),
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.OUTDATED,
        )
        work = ReviewInsightRegeneration.objects.create(
            BUSN_ID=self.business,
            RIRG_REQUESTED_REVISION=1,
        )
        self.assertEqual(
            self.detail()["review_insight_regeneration"]["status"],
            "scheduled",
        )
        ReviewInsightRegenerationService._observe_locked(work, timezone.now())
        work.RIRG_CLAIMED_REVISION = 1
        work.RIRG_ATTEMPT_TOKEN = uuid4()
        work.RIRG_LEASE_EXPIRES_AT = timezone.now() + timedelta(minutes=5)
        work.save()
        self.assertEqual(
            self.detail()["review_insight_regeneration"]["status"],
            "processing",
        )
        work.RIRG_ATTEMPT_TOKEN = None
        work.RIRG_CLAIMED_REVISION = None
        work.RIRG_LEASE_EXPIRES_AT = None
        work.RIRG_RETRY_NOT_BEFORE = timezone.now() + timedelta(minutes=2)
        work.save()
        data = self.detail()
        self.assertEqual(data["review_insight_regeneration"]["status"], "retry_wait")
        insights = data["review_insights"]
        self.assertEqual(insights["state"], "outdated")
        self.assertNotEqual(insights["generated_at"], insights["keywords_processed_at"])
        self.assertEqual(insights["frequent_mentions"], [])
        self.assertIn("thresholds", insights["policy"])
        for key in ("narrative", "eligible_review_count", "analyzed_review_count", "is_sampled"):
            self.assertIn(key, insights)

    @override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True)
    def test_serialization_uses_loaded_application_owner_rating_and_media(self):
        """Require no per-field queries and keep fetch cost stable as specialties grow."""
        application = MerchantApplication.objects.create(
            USER_ID=self.business.USER_ID,
            BUSN_ID=self.business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        identity = MerchantApplicationIdentity.objects.create(
            MAPP_ID=application,
            CLUS_ID=self.business.CTGRY_ID.CLUS_ID,
            CTGRY_ID=self.business.CTGRY_ID,
            MIDN_BUSINESS_NAME="Original application name",
            MIDN_REPRESENTATIVE_NAME="Authorized Representative",
            MIDN_REPRESENTATIVE_ROLE="owner",
        )
        identity.specialty_tags.set(self.tags)
        self.create_rating(5)
        self.photo("https://example.com/storefront.jpg")
        BusinessReviewSummary.objects.create(BUSN_ID=self.business)
        ReviewInsightRegeneration.objects.create(BUSN_ID=self.business)
        with CaptureQueriesContext(connection) as first_queries:
            business = BusinessService.get_business_detail(self.business.pk)
        with policy_scope():
            current_policy()
            with self.assertNumQueries(0):
                data = AdminBusinessDetailSerializer(business).data
        self.assertEqual(
            data["application"]["identity"]["representative_name"],
            "Authorized Representative",
        )
        self.assertEqual(data["application"]["status"], "approved")
        self.assertEqual(data["sentiment_rating"]["state"], "ready")
        for index in range(5):
            tag = SpecialtyTag.objects.create(TAG_NAME=f"Extra {index}")
            BusinessSpecialtyTag.objects.create(BUSN_ID=self.business, TAG_ID=tag)
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = BusinessService.get_business_detail(self.business.pk)
        with policy_scope():
            current_policy()
            with self.assertNumQueries(0):
                expanded_data = AdminBusinessDetailSerializer(expanded).data
        self.assertEqual(len(expanded_queries), len(first_queries))
        self.assertEqual(len(expanded_data["specialty_tags"]), 8)
        self.assertEqual(BusinessRating.objects.count(), 1)
