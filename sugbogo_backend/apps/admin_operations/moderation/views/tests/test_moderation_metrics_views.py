"""API permissions and scope validation for moderation summaries."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admin_operations.moderation.services.tests.test_manage_under_review_service import (
    create_under_review_context,
)
from apps.users.models import User
from apps.reviews.models import Review


class ModerationMetricsViewTests(TestCase):
    """Protect queue summaries with the existing Admin role boundary."""

    @classmethod
    def setUpTestData(cls):
        """Create ordinary users and an administrator identity."""
        cls.owner, cls.author, cls.business = create_under_review_context()
        cls.admin = User.objects.create(
            USER_EMAIL="metrics-admin@example.com",
            USER_FNAME="Metric",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def setUp(self):
        """Start with an authenticated administrator."""
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = reverse("admin-moderation-summary")

    def test_all_tabs_use_standard_success_envelope(self):
        """Each tab exposes its own queue-wide four-card summary."""
        for tab in ("under-review", "reported", "disputes", "suspicious"):
            with self.subTest(tab=tab):
                response = self.client.get(self.url, {"tab": tab})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["success"])
                self.assertEqual(response.data["data"]["pending"], 0)
                self.assertEqual(response.data["data"]["aging_threshold_hours"], 48)

    def test_invalid_tab_is_rejected(self):
        """Unknown tab identifiers cannot fall through to a different summary."""
        response = self.client.get(self.url, {"tab": "invalid"})
        self.assertEqual(response.status_code, 400)

    def test_aging_filter_and_full_queue_summary_use_the_same_scope(self):
        """The summary retains all cases while the queue filters before pagination."""
        old = Review.objects.create(
            USER_ID=self.author,
            BUSN_ID=self.business,
            REVW_TEXT="An aging held review.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        Review.objects.filter(pk=old.pk).update(
            REVW_CREATED_AT=timezone.now() - timedelta(hours=49),
        )
        Review.objects.create(
            USER_ID=self.owner,
            BUSN_ID=self.business,
            REVW_TEXT="A recent held review.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        queue_url = reverse("admin-under-review-list")
        response = self.client.get(queue_url, {"aging": "true"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(response.data["data"]["items"][0]["id"], old.pk)
        summary = self.client.get(self.url, {"tab": "under-review", "aging": "true"})
        self.assertEqual(summary.data["data"]["pending"], 2)
        self.assertEqual(summary.data["data"]["aging_cases"], 1)
        invalid = self.client.get(queue_url, {"aging": "invalid"})
        self.assertEqual(invalid.status_code, 400)

    def test_anonymous_and_non_admin_users_are_denied(self):
        """Only Admin and Super Admin accounts can read moderation metrics."""
        for actor in (None, self.author, self.owner):
            with self.subTest(actor=actor):
                self.client.force_authenticate(actor)
                response = self.client.get(self.url)
                self.assertIn(response.status_code, (401, 403))
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 200)
