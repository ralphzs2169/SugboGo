from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.test import APIClient

from apps.business.models import Business
from apps.reviews.models import BusinessRating, Review, ReviewRatingResult
from apps.reviews.serializers.business_rating_serializers import BusinessRatingSerializer
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class BusinessRatingServiceTests(SummaryFixtureMixin, TestCase):
    """Protect rating eligibility, compatibility, persistence and development exposure."""

    @classmethod
    def setUpTestData(cls):
        """Create one independent business without invoking inference."""
        cls.business = cls.create_business()

    def reviews(
        self,
        scores,
        **overrides,
    ):
        """Create distinct authors with arbitrary persisted score inputs."""
        offset = self.business.reviews.count()
        return [
            self.create_review(
                self.business,
                offset + index,
                REVW_SENTIMENT_SCORE=score,
                **overrides,
            )
            for index, score in enumerate(scores)
        ]

    def recompute(self):
        """Explicitly opt in to experimental legacy calculation."""
        return BusinessRatingService.recompute(
            self.business.pk,
            BusinessRatingService.LEGACY_VERSION,
            allow_legacy=True,
        )

    def test_conversion_boundaries_and_invalid_values(self):
        """Map endpoints exactly and reject missing, nonfinite and out-of-range values."""
        for score, expected in [(-1, 1), (0, 3), (1, 5)]:
            self.assertEqual(
                BusinessRatingService.convert_score(score),
                Decimal(expected),
            )
        for score in [None, True, "bad", float("nan"), float("inf"), -1.01, 1.01]:
            with self.subTest(score=score):
                with self.assertRaises(ValidationError):
                    BusinessRatingService.convert_score(score)

    def test_all_labels_contribute_without_rounding_individual_scores(self):
        """Average positive, neutral and negative inputs together at full precision."""
        for index, (score, label) in enumerate([
            (-1, "negative"),
            (-0.333, "negative"),
            (0, "neutral"),
            (0.333, "positive"),
            (1, "positive"),
            (0.07, "neutral"),
        ]):
            self.create_review(
                self.business,
                index,
                REVW_SENTIMENT_SCORE=score,
                REVW_SENTIMENT_LABEL=label,
            )
        rating = self.recompute()
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 6)
        self.assertAlmostEqual(float(rating.BRAT_VALUE), 3 + 2 * 0.07 / 6)
        self.assertEqual(rating.BRAT_STATE, BusinessRating.State.READY)

    def test_threshold_transitions_and_zero_reviews(self):
        """Move between insufficient and ready states as source membership changes."""
        rating = self.recompute()
        self.assertIsNone(rating.BRAT_VALUE)
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 0)
        self.reviews([1] * 4)
        self.assertIsNone(self.recompute().BRAT_VALUE)
        fifth = self.reviews([1])[0]
        rating = self.recompute()
        self.assertEqual(rating.BRAT_VALUE, Decimal("5"))
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 5)
        fifth.delete()
        rating = self.recompute()
        self.assertIsNone(rating.BRAT_VALUE)
        self.assertEqual(rating.BRAT_STATE, BusinessRating.State.INSUFFICIENT_DATA)

    def test_invalid_scores_and_labels_are_excluded(self):
        """Exclude NULL, nonfinite, out-of-range and unknown classifications in SQL."""
        self.reviews([0] * 5, REVW_SENTIMENT_LABEL="neutral")
        self.reviews([None, float("nan"), float("inf"), -float("inf"), 1.01, -1.01])
        self.reviews([1], REVW_SENTIMENT_LABEL=None)
        self.reviews([1], REVW_SENTIMENT_LABEL="unknown")
        self.reviews([1], REVW_TEXT=" \t\n ")
        rating = self.recompute()
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 5)
        self.assertEqual(rating.BRAT_VALUE, Decimal("3"))

    def test_unpublished_reviews_excluded_and_advisory_flags_included(self):
        """Respect publication while retaining advisory report, abuse and outlier flags."""
        self.reviews(
            [-1] * 5,
            REVW_SENTIMENT_LABEL="negative",
            REVW_IS_REPORT_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            REVW_IS_OUTLIER_SENTIMENT=True,
        )
        for status in ["under_review", "flagged", "rejected"]:
            self.reviews([1], REVW_STATUS=status)
        self.assertEqual(self.recompute().BRAT_VALUE, Decimal("1"))

    def test_old_reviews_and_repeat_recalculation(self):
        """Use all-time membership and retain a single aggregate across reruns."""
        reviews = self.reviews([0.75] * 5)
        Review.objects.filter(pk__in=[review.pk for review in reviews]).update(
            REVW_CREATED_AT=timezone.now() - timedelta(days=365),
        )
        first = self.recompute()
        second = self.recompute()
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(second.BRAT_REVIEW_COUNT, 5)
        self.assertEqual(second.BRAT_VALUE, Decimal("4.5"))
        self.assertEqual(BusinessRating.objects.count(), 1)
        self.assertEqual(
            second.BRAT_REQUESTED_REVISION,
            second.BRAT_COMPLETED_REVISION,
        )

    def test_legacy_requires_opt_in_and_preserves_review_data(self):
        """Never label historical scores as versioned or rewrite their data."""
        review = self.reviews([0.4])[0]
        before = Review.objects.values().get(pk=review.pk)
        with self.assertRaises(ValidationError):
            BusinessRatingService.recompute(
                self.business.pk,
                BusinessRatingService.LEGACY_VERSION,
            )
        self.recompute()
        self.assertEqual(before, Review.objects.values().get(pk=review.pk))
        self.assertFalse(ReviewRatingResult.objects.exists())
        data = BusinessRatingSerializer(
            Business.objects.select_related("business_rating").get(pk=self.business.pk),
        ).data
        self.assertEqual(data["provenance"], "legacy_unverified")
        self.assertTrue(data["experimental"])
        self.assertFalse(data["automatic_updates_enabled"])

    def test_versions_never_mix_and_stale_text_is_excluded(self):
        """Select precisely one method and prevent legacy fallback for explicit inputs."""
        reviews = self.reviews([1] * 6)
        for review in reviews[:5]:
            BusinessRatingService.record_result(
                review.pk,
                review.REVW_TEXT,
                -1,
                "negative",
                "example-method-v1",
            )
        BusinessRatingService.record_result(
            reviews[5].pk,
            reviews[5].REVW_TEXT,
            1,
            "positive",
            "example-method-v2",
        )
        self.assertEqual(self.recompute().BRAT_REVIEW_COUNT, 0)
        rating = BusinessRatingService.recompute(
            self.business.pk,
            "example-method-v1",
        )
        self.assertEqual(rating.BRAT_VALUE, Decimal("1"))
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 5)
        Review.objects.filter(pk=reviews[0].pk).update(REVW_TEXT="Changed content.")
        rating = BusinessRatingService.recompute(
            self.business.pk,
            "example-method-v1",
        )
        self.assertIsNone(rating.BRAT_VALUE)
        self.assertEqual(rating.BRAT_REVIEW_COUNT, 4)
        self.assertEqual(
            BusinessRatingService.recompute(
                self.business.pk,
                "example-method-v2",
            ).BRAT_REVIEW_COUNT,
            1,
        )

    def test_record_result_rejects_stale_invalid_or_reserved_inputs(self):
        """Enforce the teammate's persistence boundary without changing review scores."""
        review = self.reviews([0])[0]
        for text, score, label, version in [
            ("Different text", 0, "neutral", "v1"),
            (review.REVW_TEXT, float("nan"), "neutral", "v1"),
            (review.REVW_TEXT, 0, "unknown", "v1"),
            (review.REVW_TEXT, 0, "neutral", BusinessRatingService.LEGACY_VERSION),
            (review.REVW_TEXT, 0, "neutral", ""),
        ]:
            with self.assertRaises(ValidationError):
                BusinessRatingService.record_result(
                    review.pk,
                    text,
                    score,
                    label,
                    version,
                )
        self.assertFalse(ReviewRatingResult.objects.exists())

    def test_public_representation_rounding_pending_and_unavailable(self):
        """Represent one-decimal values and suppress pending or unsupported snapshots."""
        self.reviews([0.125] * 5)
        self.recompute()
        business = Business.objects.select_related("business_rating").get(pk=self.business.pk)
        data = BusinessRatingSerializer(business).data
        self.assertEqual(data["value"], 3.3)
        self.assertEqual(data["contributing_review_count"], 5)
        business.business_rating.BRAT_REQUESTED_REVISION += 1
        data = BusinessRatingSerializer(business).data
        self.assertEqual(data["state"], "pending")
        self.assertIsNone(data["value"])
        business.business_rating.BRAT_CALCULATION_VERSION = "unsupported"
        self.assertEqual(BusinessRatingSerializer(business).data["state"], "unavailable")

    def test_missing_aggregate_and_no_n_plus_one_reads(self):
        """Return unprocessed state without creating rows and serialize eager loads once."""
        with self.assertNumQueries(1):
            data = BusinessRatingSerializer(
                Business.objects.select_related("business_rating"),
                many=True,
            ).data
        self.assertEqual(data[0]["state"], "pending")
        self.assertIsNone(data[0]["contributing_review_count"])
        self.assertFalse(BusinessRating.objects.exists())

    def test_database_rejects_inconsistent_aggregate(self):
        """Keep ready state, minimum count and numeric presence consistent."""
        self.recompute()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BusinessRating.objects.filter(BUSN_ID=self.business).update(
                    BRAT_STATE="ready",
                    BRAT_VALUE=4,
                )

    def test_management_command_requires_explicit_mode_and_reruns(self):
        """Rebuild explicit development snapshots without duplicating aggregate rows."""
        output = StringIO()
        for _ in range(2):
            call_command(
                "recompute_business_ratings",
                "--legacy-unverified",
                "--business-id",
                str(self.business.pk),
                stdout=output,
            )
        self.assertEqual(BusinessRating.objects.count(), 1)
        self.assertIn("state=insufficient_data", output.getvalue())
        self.assertIn("experimental=True", output.getvalue())
        with self.assertRaises(CommandError):
            call_command(
                "recompute_business_ratings",
                "--scoring-version",
                BusinessRatingService.LEGACY_VERSION,
            )

    def test_missing_business_does_not_create_an_aggregate(self):
        """Return the established service error for a nonexistent business."""
        with self.assertRaises(NotFound):
            BusinessRatingService.recompute(-1, "example-v1")

    def test_api_field_is_explicitly_gated(self):
        """Keep default Explorer contracts unchanged until experimental access is enabled."""
        from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
            ExploreBusinessSerializer,
        )

        with override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=False):
            self.assertNotIn("sentiment_rating", ExploreBusinessSerializer().fields)
        with override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True):
            self.assertIn("sentiment_rating", ExploreBusinessSerializer().fields)

    @override_settings(EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True)
    def test_existing_detail_endpoint_returns_experimental_snapshot(self):
        """Expose rating and contributors inside the existing successful detail envelope."""
        self.reviews([0.4] * 5)
        self.recompute()
        client = APIClient()
        client.force_authenticate(self.business.USER_ID)
        with patch(
            "apps.explorer_operations.explore_businesses.serializers."
            "explore_business_serializer.ExploreBusinessSerializer.get_is_hidden_gem",
            return_value=False,
        ):
            response = client.get(
                f"/api/explorer/explore/businesses/{self.business.pk}/",
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        rating = response.data["data"]["sentiment_rating"]
        self.assertEqual(rating["value"], 3.8)
        self.assertEqual(rating["contributing_review_count"], 5)
        self.assertTrue(rating["experimental"])
        self.assertIn("review_insights", response.data["data"])

