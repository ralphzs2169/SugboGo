"""Administrator reporting permissions, query contracts and explicit aggregate responses."""

from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.analytics.services.platform_growth_service import PlatformGrowthService
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from .reporting_fixtures import ReportingFixtures


class ReportingViewTests(ReportingFixtures, APIResponseAssertionsMixin, APITestCase):
    ROUTES = (
        "admin-analytics-platform-growth",
        "admin-analytics-community-health",
        "admin-analytics-specialty-support",
        "admin-analytics-change-requests",
        "admin-analytics-onboarding",
    )

    def authenticate(
        self,
        role=User.UserRole.ADMIN,
        status=User.UserStatus.ACTIVE,
    ):
        self.client.force_authenticate(user=User(
            USER_ID=999,
            USER_ROLE=role,
            USER_STATUS=status,
        ))

    def test_active_admin_and_superadmin_can_read_all_reports(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.authenticate(role)
            for route in self.ROUTES:
                with self.subTest(
                    route=route,
                    role=role,
                ):
                    response = self.client.get(reverse(route))
                    self.assertEqual(
                        response.status_code,
                        200,
                    )
                    self.assertEqual(
                        set(response.data),
                        {"success", "message", "data"},
                    )
                    self.assertEqual(
                        response.data["data"]["meta"]["period"]["timezone"],
                        "Asia/Manila",
                    )

    def test_unauthenticated_nonadmin_and_inactive_accounts_are_denied(self):
        for route in self.ROUTES:
            self.client.force_authenticate(user=None)
            self.assertEqual(
                self.client.get(reverse(route)).status_code,
                401,
            )
            for role, status in (
                (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
                (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
                (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
                (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
            ):
                self.authenticate(
                    role,
                    status,
                )
                with patch.object(
                    PlatformGrowthService,
                    "get_report",
                ) as service:
                    self.assertEqual(
                        self.client.get(reverse(route)).status_code,
                        403,
                    )
                service.assert_not_called()

    def test_invalid_or_unknown_queries_are_rejected(self):
        self.authenticate()
        for route in self.ROUTES:
            for params, field in (
                ({"period": "14"}, "period"),
                ({"period": "custom"}, "start_date"),
                ({"period": "custom", "start_date": "2026-10-20", "end_date": "2026-10-21"}, "period"),
                ({"period": "custom", "start_date": "2026-10-11", "end_date": "2026-10-05"}, "period"),
                ({"city": "Cebu"}, "city"),
            ):
                self.assertValidationError(
                    self.client.get(
                        reverse(route),
                        params,
                    ),
                    field,
                )
        for route in self.ROUTES[:2]:
            self.assertValidationError(
                self.client.get(
                    reverse(route),
                    {"interval": "monthly"},
                ),
                "interval",
            )

    def test_custom_dates_weekly_selection_and_zero_empty_contracts(self):
        self.authenticate()
        for route in self.ROUTES[:2]:
            response = self.client.get(reverse(route), {
                "period": "custom",
                "start_date": "2026-10-05",
                "end_date": "2026-10-11",
                "interval": "weekly",
            })
            self.assertEqual(
                response.status_code,
                200,
            )
            data = response.data["data"]
            self.assertEqual(
                len(data["series"]),
                1,
            )
            self.assertEqual(
                data["series"][0]["start"],
                self.period.start.isoformat(),
            )
            self.assertEqual(
                data["series"][0]["end_exclusive"],
                self.period.end.isoformat(),
            )
        report = self.client.get(reverse("admin-analytics-onboarding")).data["data"]
        self.assertIsNone(report["review_turnaround"]["mean_hours"])
        self.assertIn(
            "legacy_statistics",
            report,
        )
        self.assertIn(
            "processing_meta",
            report,
        )
        self.assertEqual(
            len(report["rejection_insights"]["sections"]),
            5,
        )
        growth = self.client.get(reverse("admin-analytics-platform-growth")).data["data"]
        self.assertIsInstance(
            growth["activity"]["new_consumer_accounts"]["change"]["value"],
            int,
        )

    def test_output_serializers_do_not_leak_extra_identity_fields(self):
        self.authenticate()
        report = PlatformGrowthService.get_report(self.period)
        report["user_ids"] = [123]
        report["inventory"]["emails"] = ["private@example.com"]
        with patch.object(
            PlatformGrowthService,
            "get_report",
            return_value=report,
        ):
            response = self.client.get(reverse("admin-analytics-platform-growth"))
        self.assertNotIn(
            "user_ids",
            response.data["data"],
        )
        self.assertNotIn(
            "emails",
            response.data["data"]["inventory"],
        )

    def test_reports_are_get_only(self):
        self.authenticate()
        for route in self.ROUTES:
            for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
                self.assertEqual(
                    method(
                        reverse(route),
                        {},
                        format="json",
                    ).status_code,
                    405,
                )
