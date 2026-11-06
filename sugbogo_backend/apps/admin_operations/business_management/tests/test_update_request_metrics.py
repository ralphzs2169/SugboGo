"""Summary scope, elapsed aging, daily decisions, and queue parity coverage."""

from datetime import timedelta

from django.urls import reverse

from apps.admin_operations.business_management.services.update_request_metrics_service import (
    REQUEST_MODELS,
)

from . import test_update_request_business_filter as business_filter_tests


class UpdateRequestMetricsTests(business_filter_tests.UpdateRequestBusinessFilterTests):
    """Exercise metrics against the same three persisted queue fixtures."""

    def test_summary_uses_all_types_and_scopes_without_table_filters(self):
        """Full counts honor type and business while ignoring search and pagination."""
        for name, model, prefix in REQUEST_MODELS:
            model.objects.filter(BUSN_ID=self.business).update(**{
                f"{prefix}_SUBMITTED_AT": self.NOW - timedelta(hours=48),
            })
        url = reverse("admin-update-request-summary")
        response = self.client.get(url, {"status": "approved", "search": "missing", "page_size": 1})
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["pending"], 6)
        self.assertEqual(data["aging_requests"], 3)
        self.assertEqual(data["oldest_pending"]["seconds"], 48 * 3600)
        for name, model, prefix in REQUEST_MODELS:
            scoped = self.client.get(url, {"request_type": name, "business_id": self.business.pk})
            self.assertEqual(scoped.data["data"]["pending"], 1)
            self.assertEqual(scoped.data["data"]["aging_requests"], 1)
            self.assertEqual(scoped.data["data"]["oldest_pending"]["request_type"], name)

    def test_aging_card_matches_all_three_paginated_queues(self):
        """The inclusive 48-hour boundary is applied before pagination."""
        for name, model, prefix in REQUEST_MODELS:
            model.objects.filter(BUSN_ID=self.business).update(**{
                f"{prefix}_SUBMITTED_AT": self.NOW - timedelta(hours=48),
            })
            model.objects.filter(BUSN_ID=self.other).update(**{
                f"{prefix}_SUBMITTED_AT": self.NOW - timedelta(hours=47),
            })
        for route in self.routes:
            response = self.client.get(route, {"queue_view": "aging", "page_size": 1})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
            self.assertEqual(response.data["data"]["items"][0]["business_id"], self.business.pk)
            self.assertEqual(self.client.get(route, {"queue_view": "invalid"}).status_code, 400)

    def test_daily_decisions_use_philippine_midnight_and_exclude_withdrawals(self):
        """Prior UTC-day decisions within the Philippine day count exactly once."""
        within_today = self.NOW.replace(hour=0) - timedelta(hours=7)
        before_today = self.NOW.replace(hour=0) - timedelta(hours=8, minutes=1)
        for name, model, prefix in REQUEST_MODELS:
            model.objects.filter(BUSN_ID=self.business).update(**{
                f"{prefix}_STATUS": "approved",
                f"{prefix}_RESOLVED_AT": within_today,
            })
            model.objects.filter(BUSN_ID=self.other).update(**{
                f"{prefix}_STATUS": "rejected",
                f"{prefix}_RESOLVED_AT": before_today,
            })
        url = reverse("admin-update-request-summary")
        self.assertEqual(self.client.get(url).data["data"]["resolved_today"], 3)
        for route in self.routes:
            response = self.client.get(route, {"queue_view": "resolved_today"})
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        for name, model, prefix in REQUEST_MODELS:
            model.objects.filter(BUSN_ID=self.business).update(**{
                f"{prefix}_STATUS": "withdrawn",
            })
        self.assertEqual(self.client.get(url).data["data"]["resolved_today"], 0)

    def test_empty_scope_has_real_zeros_and_no_oldest_request(self):
        """An unmatched business has no invented elapsed waiting time."""
        response = self.client.get(
            reverse("admin-update-request-summary"),
            {"business_id": self.other.pk + 100},
        )
        self.assertEqual(response.data["data"]["pending"], 0)
        self.assertEqual(response.data["data"]["aging_requests"], 0)
        self.assertEqual(response.data["data"]["resolved_today"], 0)
        self.assertIsNone(response.data["data"]["oldest_pending"])

    def test_summary_validates_scope_and_protects_admin_access(self):
        """Summary access matches the existing request review permissions."""
        url = reverse("admin-update-request-summary")
        for params in ({"request_type": "invalid"}, {"business_id": 0}):
            self.assertEqual(self.client.get(url, params).status_code, 400)
        self.client.force_authenticate(self.business.USER_ID)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(url).status_code, (401, 403))
