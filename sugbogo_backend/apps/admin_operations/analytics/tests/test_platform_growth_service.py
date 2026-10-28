"""Inventory populations, approval event identity and Manila growth periods."""

from datetime import timedelta

from django.test import TestCase

from apps.admin_operations.analytics.services.platform_growth_service import PlatformGrowthService
from apps.business.models import Business
from apps.users.models import User
from apps.shared.analytics.date_ranges import resolve_period

from .reporting_fixtures import ReportingFixtures


class PlatformGrowthServiceTests(ReportingFixtures, TestCase):
    def test_empty_dataset_has_zero_counts_zero_buckets_and_no_snapshot_comparison(self):
        report = PlatformGrowthService.get_report(self.period)
        self.assertEqual(
            report["inventory"]["consumer_accounts"],
            0,
        )
        self.assertEqual(
            report["activity"]["new_businesses"]["change"]["value"],
            0,
        )
        self.assertEqual(
            len(report["series"]),
            7,
        )
        self.assertTrue(all(row["new_consumer_accounts"] == 0 for row in report["series"]))
        self.assertNotIn(
            "change",
            report["inventory"],
        )
        self.assertFalse(report["inventory"]["selected_period_applies"])

    def test_current_inventory_excludes_staff_and_administrator_accounts(self):
        self.make_user()
        self.make_user(User.UserRole.MERCHANT)
        self.make_user(User.UserRole.ADMIN)
        self.make_user(User.UserRole.SUPER_ADMIN)
        self.make_user(is_staff=True)
        self.make_user(is_superuser=True)
        self.make_business()
        self.make_business(Business.BusinessStatus.SUSPENDED)
        report = PlatformGrowthService.get_report(self.period)
        inventory = report["inventory"]
        self.assertEqual(
            inventory["consumer_accounts"],
            4,
        )
        self.assertEqual(
            inventory["current_explorer_accounts"],
            1,
        )
        self.assertEqual(
            inventory["current_merchant_accounts"],
            3,
        )
        self.assertEqual(
            inventory["total_businesses"],
            2,
        )
        self.assertEqual(
            inventory["active_businesses"],
            1,
        )
        self.assertEqual(
            inventory["suspended_businesses"],
            1,
        )

    def test_creation_windows_are_half_open_and_compare_equal_prior_periods(self):
        self.make_user(created_at=self.period.start)
        self.make_user(created_at=self.period.end - timedelta(microseconds=1))
        self.make_user(created_at=self.period.end)
        self.make_user(created_at=self.period.previous_start)
        self.make_business(created_at=self.period.start)
        self.make_business(created_at=self.period.previous_start)
        report = PlatformGrowthService.get_report(self.period)
        accounts = report["activity"]["new_consumer_accounts"]
        self.assertEqual(
            accounts["value"],
            2,
        )
        self.assertEqual(
            accounts["previous_value"],
            1,
        )
        self.assertEqual(
            accounts["change"]["value"],
            1,
        )
        self.assertEqual(
            accounts["change"]["unit"],
            "count",
        )
        self.assertEqual(
            report["activity"]["new_businesses"]["change"]["value"],
            0,
        )
        self.assertEqual(
            sum(row["new_consumer_accounts"] for row in report["series"]),
            2,
        )

    def test_approvals_count_first_recorded_event_per_linked_business_not_current_roles(self):
        business = self.make_business(Business.BusinessStatus.SUSPENDED)
        application = self.make_application(business)
        self.make_decision(
            application,
            self.period.start,
            "approved",
        )
        self.make_decision(
            application,
            self.period.start,
            "approved",
        )
        self.make_decision(
            application,
            self.period.start + timedelta(days=1),
            "approved",
        )
        older = self.make_application(self.make_business())
        self.make_decision(
            older,
            self.period.previous_start,
            "approved",
        )
        self.make_decision(
            older,
            self.period.start,
            "approved",
        )
        unlinked = self.make_application()
        self.make_decision(
            unlinked,
            self.period.start,
            "approved",
        )
        report = PlatformGrowthService.get_report(self.period)
        approvals = report["activity"]["newly_approved_businesses"]
        self.assertEqual(
            approvals["value"],
            1,
        )
        self.assertEqual(
            approvals["previous_value"],
            1,
        )
        self.assertEqual(
            sum(row["newly_approved_businesses"] for row in report["series"]),
            1,
        )

    def test_current_roles_can_change_inventory_without_erasing_consumer_creation(self):
        user = self.make_user(created_at=self.period.start)
        User.objects.filter(pk=user.pk).update(USER_ROLE=User.UserRole.MERCHANT)
        report = PlatformGrowthService.get_report(self.period)
        self.assertEqual(
            report["inventory"]["current_explorer_accounts"],
            0,
        )
        self.assertEqual(
            report["inventory"]["current_merchant_accounts"],
            1,
        )
        self.assertEqual(
            report["activity"]["new_consumer_accounts"]["value"],
            1,
        )
        self.assertEqual(
            report["activity"]["newly_approved_businesses"]["value"],
            0,
        )

    def test_weekly_buckets_and_query_count_do_not_depend_on_population_size(self):
        for index in range(4):
            self.make_user(created_at=self.period.start + timedelta(days=index))
        with self.assertNumQueries(8):
            report = PlatformGrowthService.get_report(
                self.period,
                interval="weekly",
            )
        self.assertEqual(
            len(report["series"]),
            1,
        )
        self.assertEqual(
            report["series"][0]["start"],
            self.period.start.isoformat(),
        )
        self.assertEqual(
            report["series"][0]["end_exclusive"],
            self.period.end.isoformat(),
        )

    def test_presets_keep_partial_day_comparisons_equal_and_weekly_buckets_clipped(self):
        for preset in ("7", "30", "90"):
            period = resolve_period(
                preset=preset,
                now=self.NOW,
            )
            with self.subTest(preset=preset):
                report = PlatformGrowthService.get_report(
                    period,
                    interval="weekly",
                )
                self.assertEqual(
                    period.end,
                    self.NOW,
                )
                self.assertEqual(
                    period.end - period.start,
                    period.previous_end - period.previous_start,
                )
                self.assertEqual(
                    report["series"][0]["start"],
                    period.start.isoformat(),
                )
                self.assertEqual(
                    report["series"][-1]["end_exclusive"],
                    self.NOW.isoformat(),
                )
                self.assertIn(
                    "current_day_incomplete",
                    report["meta"]["partial_reasons"],
                )
