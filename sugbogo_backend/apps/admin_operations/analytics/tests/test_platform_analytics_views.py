"""Admin analytics access, validation and serialized response contracts."""

from datetime import UTC, datetime
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APISimpleTestCase

from apps.admin_operations.analytics.services.discovery_analytics_service import DiscoveryAnalyticsService
from apps.admin_operations.analytics.services.platform_analytics_service import PlatformAnalyticsService
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.analytics.metadata import build_meta
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class PlatformAnalyticsViewTests(APIResponseAssertionsMixin, APISimpleTestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 12, 4, tzinfo=UTC)
        self.period = resolve_period(now=self.now)
        self.overview_url = reverse("get_analytics_data")
        self.trend_url = reverse("admin-discovery-trend")
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.now)
        clock.start()
        self.addCleanup(clock.stop)

    def authenticate(self, role=User.UserRole.ADMIN, status=User.UserStatus.ACTIVE):
        self.client.force_authenticate(user=User(USER_ID=900, USER_ROLE=role, USER_STATUS=status))

    def overview_payload(self):
        meta = build_meta(self.period)
        kpis = {
            key: PlatformAnalyticsService._snapshot(2, label, "Current snapshot.", self.period)
            for key, label in (("active_businesses", "Active businesses"), ("approved_businesses", "Approved businesses"))
        }
        for key, source, label in (
            ("new_explorer_accounts", "domain", "New explorer accounts"),
            ("discovery_active_explorers", "visibility", "Discovery-active explorers (not total app MAU)"),
        ):
            kpis[key] = {
                "label": label, "description": "Period activity.", "measurement_type": "period",
                "value": 3, "previous_value": 1,
                "change": compare_values(current=3, previous=1, current_sample_size=3, previous_sample_size=1),
                "source": source,
                "explorer_ids": [999],  # Must never escape explicit output serializers.
            }
        return {
            "kpis": kpis, "new_explorer_accounts_weekly": [], "registration_series_is_sparse": True,
            "meta": meta,
            "sources": {"domain": meta, "visibility_current": meta, "visibility_previous": meta},
        }

    def test_admin_and_superadmin_can_read_overview_and_trend(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.authenticate(role)
                with patch.object(PlatformAnalyticsService, "get_overview", return_value=self.overview_payload()):
                    response = self.client.get(self.overview_url)
                self.assertSuccessResponse(response, message="Platform analytics retrieved successfully.")
                self.assertEqual(set(response.data), {"success", "message", "data"})
                self.assertNotIn("explorer_ids", response.data["data"]["kpis"]["discovery_active_explorers"])
                with patch.object(VisibilityEventService, "get_analytics_totals", return_value={
                    "IMPRESSION": 0, "PROFILE_VISIT": 0, "SAVE": 0,
                }), patch.object(VisibilityEventService, "get_analytics_series", return_value=[]):
                    response = self.client.get(self.trend_url)
                self.assertSuccessResponse(response, message="Discovery trend retrieved successfully.")
                self.assertEqual(response.data["data"]["value"], 0)
                self.assertEqual(response.data["data"]["series"], [])

    def test_unauthenticated_requests_are_rejected_before_services(self):
        with patch.object(PlatformAnalyticsService, "get_overview") as overview, patch.object(
            DiscoveryAnalyticsService, "get_report",
        ) as discovery:
            self.assertEqual(self.client.get(self.overview_url).status_code, 401)
            self.assertEqual(self.client.get(self.trend_url).status_code, 401)
        overview.assert_not_called()
        discovery.assert_not_called()

    def test_non_admin_and_inactive_admin_access_is_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, status=status):
                self.authenticate(role, status)
                with patch.object(PlatformAnalyticsService, "get_overview") as overview:
                    self.assertEqual(self.client.get(self.overview_url).status_code, 403)
                overview.assert_not_called()
                with patch.object(DiscoveryAnalyticsService, "get_report") as discovery:
                    self.assertEqual(self.client.get(self.trend_url).status_code, 403)
                discovery.assert_not_called()

    def test_invalid_queries_use_existing_validation_envelope(self):
        self.authenticate()
        for params, field in (
            ({"period": "14"}, "period"),
            ({"period": "custom"}, "start_date"),
            ({"period": "custom", "start_date": "2026-10-13", "end_date": "2026-10-13"}, "period"),
            ({"period": "custom", "start_date": "2026-10-11", "end_date": "2026-10-10"}, "period"),
            ({"start_date": "invalid"}, "start_date"),
            ({"start_date": "2026-10-01"}, "preset"),
            ({"metric": "revenue"}, "metric"),
            ({"interval": "monthly"}, "interval"),
            ({"business_id": "10"}, "business_id"),
        ):
            with self.subTest(params=params), patch.object(DiscoveryAnalyticsService, "get_report") as service:
                response = self.client.get(self.trend_url, params)
                self.assertValidationError(response, field)
                service.assert_not_called()

    def test_custom_dates_and_distinct_weekly_selection_are_delegated(self):
        self.authenticate()
        with patch.object(VisibilityEventService, "count_analytics_explorers", return_value=2) as count, patch.object(
            VisibilityEventService, "get_analytics_explorer_series", return_value=[],
        ) as series:
            response = self.client.get(self.trend_url, {
                "period": "custom", "start_date": "2026-10-10", "end_date": "2026-10-10",
                "metric": "distinct_engaged_explorers", "interval": "weekly",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(count.call_args_list[0].kwargs["start_time"], datetime(2026, 10, 9, 16, tzinfo=UTC))
        self.assertEqual(count.call_args_list[0].kwargs["end_time"], datetime(2026, 10, 10, 16, tzinfo=UTC))
        self.assertEqual(series.call_args.kwargs["interval"], "weekly")
        self.assertIn("not total app MAU", response.data["data"]["description"])

    def test_unavailable_trend_is_a_successful_report_with_null_metrics(self):
        self.authenticate()
        with patch.object(VisibilityEventService, "get_analytics_totals", side_effect=VisibilityTrackingUnavailable()), patch.object(
            VisibilityEventService, "get_analytics_series", side_effect=VisibilityTrackingUnavailable(),
        ):
            response = self.client.get(self.trend_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        report = response.data["data"]
        self.assertIsNone(report["value"])
        self.assertIsNone(report["series"])
        self.assertEqual(report["meta"]["availability"], "unavailable")

    def test_existing_discovery_score_route_names_are_preserved(self):
        self.assertEqual(reverse("discovery-score-list"), "/api/admin/analytics/discovery-scores/")
        self.assertEqual(reverse("discovery-score-recompute"), "/api/admin/analytics/discovery-scores/recompute/")
