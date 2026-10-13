"""Operations endpoint role access, period validation and response contracts."""

from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.analytics.tests.test_attention_queue_service import OperationsFixtures
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class OperationsAnalyticsViewTests(OperationsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        self.urls = [reverse("admin-analytics-onboarding"), reverse("admin-analytics-attention-queue")]
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        self.authenticate()

    def authenticate(self, role=User.UserRole.ADMIN, status=User.UserStatus.ACTIVE):
        self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))

    def test_admin_and_superadmin_get_successful_aggregate_responses(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.authenticate(role)
            for url in self.urls:
                with self.subTest(role=role, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.data["success"])
                    self.assertEqual(response.data["data"]["meta"]["period"]["timezone"], "Asia/Manila")

    def test_other_roles_inactive_admins_and_anonymous_are_rejected(self):
        for role, status in (
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        ):
            self.authenticate(role, status)
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(user=None)
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_invalid_and_unknown_period_parameters_are_rejected(self):
        for url in self.urls:
            for params, field in (
                ({"period": "14"}, "period"), ({"metric": "users"}, "metric"),
                ({"period": "custom", "start_date": "2026-10-12", "end_date": "2026-10-01"}, "period"),
            ):
                self.assertValidationError(self.client.get(url, params), field)

    def test_onboarding_contract_labels_legacy_scope_and_null_rates(self):
        result = self.client.get(self.urls[0]).data["data"]
        self.assertEqual(result["legacy_meta"]["timezone"], "UTC")
        self.assertFalse(result["legacy_meta"]["selected_period_applies"])
        self.assertIsNone(result["legacy_statistics"]["approval_rate"])
        self.assertIn("legacy_onboarding_timezone_and_window_exception", result["meta"]["partial_reasons"])
        self.assertIn("approaching_business_days", result["aging_meta"])

    def test_old_backlog_is_visible_for_short_period_and_no_median_is_null(self):
        self.report(timedelta(days=90))
        result = self.client.get(self.urls[1], {"period": "7"}).data["data"]
        self.assertEqual(result["open_reports"]["days_3_plus"], 1)
        self.assertFalse(result["queue_meta"]["selected_period_applies"])
        self.assertFalse(result["queue_meta"]["history_available"])
        self.assertIsNone(result["completed_dispute_turnaround"]["median_hours"])
        self.assertEqual(result["completed_dispute_turnaround"]["sample_count"], 0)
        self.assertNotIn("items", result)
