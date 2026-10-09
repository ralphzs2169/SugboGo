from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import ReportFixtures
from apps.reviews.models import ReviewPhoto
from apps.users.models import User, ReputationEvent


class ReviewSecurityBenchmarkTests(ReportFixtures, TestCase):
    """Exercise review security boundaries through actual JWT authentication."""

    def setUp(self):
        """Prepare report fixtures and an API client without forced authentication."""
        super().setUp()
        self.client = APIClient()
        self.queue_url = reverse("admin-review-report-list")
        self.approve_url = reverse("admin-review-report-approve", args=[self.report.pk])

    def authenticate(self, user):
        """Issue a signed access token for the specified fixture user."""
        token = AccessToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return token

    def assert_unchanged(self):
        """Verify denied requests leave moderation state and accounting intact."""
        self.report.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, "pending")
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())

    def test_signed_explorer_token_cannot_resolve_even_with_spoofed_actor(self):
        self.authenticate(self.user)
        response = self.client.post(self.approve_url, {
            "admin_notes": "Evidence inspected and decision recorded.",
            "actor": self.admin.pk, "USER_ROLE": "admin",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assert_unchanged()

    def test_existing_token_loses_access_after_admin_role_revoked(self):
        self.authenticate(self.admin)
        self.admin.USER_ROLE = User.UserRole.EXPLORER
        self.admin.save(update_fields=["USER_ROLE"])
        self.assertEqual(self.client.get(self.queue_url).status_code, 403)
        self.assert_unchanged()

    def test_existing_token_loses_access_after_account_disabled(self):
        self.authenticate(self.admin)
        self.admin.USER_STATUS = User.UserStatus.DISABLED
        self.admin.save(update_fields=["USER_STATUS"])
        response = self.client.post(self.approve_url, {
            "admin_notes": "Evidence inspected and decision recorded.",
        }, format="json")
        self.assertEqual(response.status_code, 401)
        self.assert_unchanged()

    def test_expired_access_token_cannot_read_report_evidence(self):
        token = self.authenticate(self.admin)
        token.set_exp(lifetime=timedelta(minutes=-5))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("admin-review-report-detail", args=[self.report.pk])
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assert_unchanged()

    def test_modified_token_signature_is_rejected(self):
        token = str(self.authenticate(self.admin))
        header, payload, signature = token.split(".")
        replacement = "A" if signature[0] != "A" else "B"
        tampered = f"{header}.{payload}.{replacement}{signature[1:]}"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered}")
        self.assertEqual(self.client.get(self.queue_url).status_code, 401)
        self.assert_unchanged()

    def test_author_cannot_assign_moderation_fields_through_review_edit(self):
        self.authenticate(self.second_user)
        with patch("apps.reviews.tasks.process_review_sentiment.delay"):
            response = self.client.patch(
                reverse("review-detail", args=[self.review.pk]),
                {"text": "Updated review text with sufficient detail for inspection.",
                 "REVW_STATUS": "rejected", "USER_ID": self.admin.pk,
                 "REVW_SENTIMENT_LABEL": "positive"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.review.refresh_from_db()
        self.assertEqual(self.review.USER_ID_id, self.second_user.pk)
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertIsNone(self.review.REVW_SENTIMENT_LABEL)

    def test_other_user_cannot_edit_delete_review_or_delete_its_photo(self):
        photo = ReviewPhoto.objects.create(
            REVW_ID=self.review, RPHO_PHOTO_URL="https://example.com/review.jpg",
        )
        self.authenticate(self.user)
        url = reverse("review-detail", args=[self.review.pk])
        old_text = self.review.REVW_TEXT
        self.assertEqual(self.client.patch(url, {
            "text": "Unauthorized replacement review text with sufficient detail.",
        }, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertEqual(self.client.delete(
            reverse("review-photo", args=[photo.pk]),
        ).status_code, 403)
        self.assert_unchanged()
        self.assertEqual(self.review.REVW_TEXT, old_text)
        self.assertTrue(ReviewPhoto.objects.filter(pk=photo.pk).exists())
