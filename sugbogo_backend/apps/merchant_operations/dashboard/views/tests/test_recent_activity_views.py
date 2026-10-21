from datetime import timedelta

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.services.visibility_event_service import VisibilityTrackingUnavailable
from apps.merchant_operations.dashboard.services.tests.fixtures import (
    RecentActivityFixtures,
)
from apps.notifications.models import Notification
from apps.users.models import User


class RecentActivityViewTests(RecentActivityFixtures, APITestCase):
    """Verify ownership, privacy, strict input handling, and partial-source responses."""

    def setUp(self):
        """Authenticate one merchant against the fixed dashboard route."""
        super().setUp()
        self.url = reverse("merchant-dashboard-recent-activity")
        self.client.force_authenticate(self.merchant_a)

    def test_empty_snapshot_has_an_explicit_source_contract(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(response.data["success"])
        self.assertEqual(data["items"], [])
        self.assertEqual(data["business"]["id"], self.business_a.pk)
        self.assertEqual(data["timezone"], "Asia/Manila")
        self.assertEqual(data["grouping"], {"vouches": "explorer_day", "saves": "day"})
        self.assertEqual(data["sources"]["saves"], {
            "availability": "available",
            "coverage": "recorded_events_only",
        })
        self.assertFalse(data["is_partial"])

    def test_reviews_have_a_destination_and_save_rows_never_disclose_identity(self):
        review = self.review(self.NOW - timedelta(minutes=2))
        self.save_days.return_value = [{
            "date": self.NOW.date().isoformat(),
            "count": 3,
            "occurred_at": self.NOW - timedelta(minutes=1),
        }]
        response = self.client.get(self.url)
        save, review_item = response.data["data"]["items"]
        self.assertEqual(save["title"], "3 explorers saved your business")
        self.assertIsNone(save["actor_name"])
        self.assertIsNone(save["target"])
        self.assertNotIn("explorer_id", str(save))
        self.assertNotIn("USER_ID", str(save))
        self.assertNotIn("email", str(response.data).lower())
        self.assertEqual(review_item["target"], {
            "type": "business_review",
            "id": review.pk,
        })

    def test_snapshot_uses_the_authenticated_owner_and_does_not_write_notifications(self):
        self.review(self.NOW - timedelta(minutes=1))
        self.review(self.NOW - timedelta(minutes=1), business=self.business_b)
        self.client.force_authenticate(self.merchant_b)
        count = Notification.objects.count()
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["business"]["id"], self.business_b.pk)
        self.assertEqual(len(response.data["data"]["items"]), 1)
        self.assertEqual(Notification.objects.count(), count)
        self.save_days.assert_called_once_with(
            business_id=self.business_b.pk,
            as_of=self.NOW,
            limit=5,
        )

    def test_reporting_and_ownership_parameters_are_rejected(self):
        for key, value in (
            ("business_id", self.business_b.pk),
            ("user_id", self.merchant_b.pk),
            ("period", "30"),
            ("as_of", self.NOW.isoformat()),
            ("limit", "50"),
        ):
            with self.subTest(parameter=key):
                response = self.client.get(self.url, {key: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn(key, response.data["errors"])

    def test_optional_tracking_failure_returns_partial_success(self):
        self.review(self.NOW - timedelta(minutes=1))
        self.save_days.side_effect = VisibilityTrackingUnavailable()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(data["is_partial"])
        self.assertEqual(data["sources"]["saves"]["availability"], "unavailable")
        self.assertEqual(len(data["items"]), 1)

    def test_requires_a_merchant_with_an_owned_business(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(self.supporter_a)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        merchant = self.user("no-business", User.UserRole.MERCHANT)
        self.client.force_authenticate(merchant)
        self.assertEqual(self.client.get(self.url).status_code, 404)
