from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.review_disputes.views.tests import test_review_dispute_views as dispute_tests
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_service import (
    ReviewEditContentFlagged,
    ReviewEditModerationUnavailable,
    ReviewService,
)


class MerchantReviewChangeIndicatorTests(APITestCase):
    create_dispute = dispute_tests.MerchantReviewDisputeViewTestBase.create_dispute

    def setUp(self):
        dispute_tests.MerchantReviewDisputeViewTestBase.setUp(self)
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="review/original",
        )
        self.dispute = self.create_dispute()
        self.moderate = self.enterContext(patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={"outcome": "safe", "findings": []},
        ))
        self.enterContext(patch.object(ReviewService, "_queue_sentiment_after_commit"))

    def detail(
        self,
        dispute=None,
        **params,
    ):
        response = self.client.get(
            reverse(
                "review-dispute-detail",
                args=[(dispute or self.dispute).pk],
            ),
            params,
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["data"]

    def edit(
        self,
        **kwargs,
    ):
        return ReviewService.update_review(
            user=self.explorer,
            review_id=self.review.pk,
            **kwargs,
        )

    def test_matching_content_returns_false_and_no_admin_snapshot_data(self):
        data = self.detail(material_content_changed="true")
        self.assertIs(data["material_content_changed"], False)
        for private_field in (
            "snapshot",
            "review_at_filing",
            "current_review",
            "current_content_fingerprint",
            "filing_snapshot_unavailable",
        ):
            self.assertNotIn(private_field, data)
        self.assertNotIn("public_id", data["review"]["photos"][0])

    def test_successful_text_edit_returns_true_without_closing_dispute(self):
        self.edit(text="Updated published review after filing.")
        data = self.detail()
        self.assertIs(data["material_content_changed"], True)
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["review"]["text"], "Updated published review after filing.")
        self.assertEqual(self.dispute.snapshot.MRDS_TEXT, self.review.REVW_TEXT)

    def test_photo_removal_is_a_material_change(self):
        self.edit(keep_photo_ids=[])
        data = self.detail()
        self.assertIs(data["material_content_changed"], True)
        self.assertEqual(data["review"]["photos"], [])
        self.assertEqual(len(self.dispute.snapshot.MRDS_PHOTOS), 1)

    def test_photo_addition_is_a_material_change(self):
        with patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
            return_value={
                "public_id": "review/additional",
                "secure_url": "https://example.com/additional.jpg",
            },
        ):
            self.edit(photos=[object()])
        self.assertIs(self.detail()["material_content_changed"], True)

    def test_failed_ai_edits_do_not_report_a_published_content_change(self):
        for outcome, exception in (
            ("flagged", ReviewEditContentFlagged),
            ("provider_failure", ReviewEditModerationUnavailable),
        ):
            with self.subTest(outcome=outcome):
                self.moderate.return_value = {"outcome": outcome, "findings": []}
                with self.assertRaises(exception):
                    self.edit(text="A proposed edit that cannot be published.")
                self.assertIs(self.detail()["material_content_changed"], False)

    def test_reverting_content_matches_snapshot_despite_new_edit_timestamp(self):
        self.edit(text="An intermediate safe edit.")
        self.edit(text=self.review.REVW_TEXT)
        self.assertIs(self.detail()["material_content_changed"], False)

    def test_publication_and_engagement_metadata_do_not_change_indicator(self):
        Review.objects.filter(pk=self.review.pk).update(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
            REVW_LIKE_COUNT=20,
            REVW_REPORT_COUNT=4,
        )
        self.assertIs(self.detail()["material_content_changed"], False)

    def test_deleted_review_returns_unknown_without_losing_dispute_history(self):
        ReviewService.delete_review(self.explorer, self.review.pk)
        data = self.detail()
        self.assertIsNone(data["material_content_changed"])
        self.assertIsNone(data["review"])
        self.assertEqual(data["review_id"], self.review.pk)
        self.assertEqual(data["status"], "author_deleted")
        self.assertEqual(data["description"], self.dispute.MRDSP_DESCRIPTION)

    def test_legacy_attempt_has_unknown_comparison_and_no_fabricated_snapshot(self):
        self.dispute.snapshot.delete()
        data = self.detail()
        self.assertIsNone(data["material_content_changed"])
        self.assertNotIn("review_at_filing", data)

    def test_each_attempt_compares_against_its_own_filing_content(self):
        ReviewDisputeService.withdraw_dispute(self.merchant, self.dispute.pk)
        self.edit(text="A different review challenged by the next attempt.")
        second = self.create_dispute()
        data = self.detail(second)
        self.assertIs(data["material_content_changed"], False)
        self.assertEqual(data["attempt_number"], 2)
        self.assertEqual(data["previous_disputes"][0]["id"], self.dispute.pk)
        self.assertNotIn("material_content_changed", data["previous_disputes"][0])
        self.assertIs(self.detail()["material_content_changed"], True)

    def test_comparison_remains_merchant_owner_only(self):
        self.client.force_authenticate(self.other_merchant)
        response = self.client.get(reverse(
            "review-dispute-detail",
            args=[self.dispute.pk],
        ))
        self.assertEqual(response.status_code, 403)
