"""Manila calendar-boundary regression coverage for shared application queues."""

from datetime import datetime
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.admin_operations.dashboard.priority_worklist_service import (
    PriorityWorklistService,
)
from apps.admin_operations.dashboard.services import DashboardSummaryService
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.merchant_application.utils.application_queue import (
    count_business_days,
    get_application_queue_status,
)


class ManilaApplicationAgingTests(DashboardFixtures, TestCase):
    """Keep Python ages, SQL queues, and priority ordering on the same Manila date."""

    def test_midnight_to_eight_am_uses_monday_urgency_in_every_active_timezone(self):
        """Advance weekday urgency at Manila midnight rather than UTC midnight."""
        submitted = datetime.fromisoformat("2026-10-26T10:00:00+08:00")
        application = self.create_application(submitted_at=submitted)
        for zone in ("UTC", "America/New_York", "Asia/Manila"):
            for hour in (0, 1, 7, 8):
                now = datetime.fromisoformat(
                    f"2026-11-02T{hour:02}:30:00+08:00",
                )
                with (
                    self.subTest(zone=zone, hour=hour),
                    timezone.override(zone),
                    patch("django.utils.timezone.now", return_value=now),
                ):
                    self.assertEqual(count_business_days(submitted, now), 5)
                    self.assertEqual(
                        get_application_queue_status(submitted),
                        "overdue",
                    )
                    summary = DashboardSummaryService.get_summary()
                    self.assertEqual(
                        summary["applications"]["aging"]["overdue"],
                        1,
                    )
                    applications = ApplicationService.list_applications(
                        queue_status="overdue",
                    )
                    self.assertEqual(
                        list(applications.values_list("pk", flat=True)),
                        [application.pk],
                    )
                    item = PriorityWorklistService.get_worklist()["items"][0]
                    self.assertEqual(item["priority"], "overdue")
                    self.assertEqual(
                        item["application_aging"]["business_days"],
                        5,
                    )

    def test_weekend_transition_does_not_add_weekdays_until_monday(self):
        """Exclude submission day, Saturday, and Sunday across Manila boundaries."""
        submitted = datetime.fromisoformat("2026-10-26T23:30:00+08:00")
        self.create_application(submitted_at=submitted)
        for date, days, status in (
            ("2026-10-26", 0, "on_time"),
            ("2026-10-28", 2, "on_time"),
            ("2026-10-29", 3, "approaching"),
            ("2026-10-30", 4, "approaching"),
            ("2026-10-31", 4, "approaching"),
            ("2026-11-01", 4, "approaching"),
            ("2026-11-02", 5, "overdue"),
        ):
            now = datetime.fromisoformat(f"{date}T23:45:00+08:00")
            with (
                self.subTest(date=date),
                patch("django.utils.timezone.now", return_value=now),
            ):
                self.assertEqual(count_business_days(submitted, now), days)
                self.assertEqual(get_application_queue_status(submitted), status)
                summary = DashboardSummaryService.get_summary()
                aging = summary["applications"]["aging"]
                self.assertEqual(aging[status], 1)
                self.assertEqual(sum(aging.values()), 1)

    def test_sql_submission_dates_and_worklist_tiers_match_manila_python_ages(self):
        """Keep early-morning submissions out of the previous UTC date's urgency tier."""
        now = datetime.fromisoformat("2026-11-02T00:30:00+08:00")
        overdue = self.create_application(
            submitted_at=datetime.fromisoformat("2026-10-26T10:00:00+08:00"),
        )
        approaching = self.create_application(
            submitted_at=datetime.fromisoformat("2026-10-27T00:15:00+08:00"),
        )
        on_time = self.create_application(
            submitted_at=datetime.fromisoformat("2026-10-30T00:15:00+08:00"),
        )
        unknown = self.create_application(submitted_at=None)
        with patch("django.utils.timezone.now", return_value=now):
            items = PriorityWorklistService.get_worklist()["items"]
            self.assertEqual(
                [
                    item["entity"]["id"]
                    for item in items
                ],
                [overdue.pk, approaching.pk, on_time.pk, unknown.pk],
            )
            self.assertEqual(
                [
                    item["application_aging"]["business_days"]
                    for item in items
                ],
                [5, 4, 1, None],
            )
            for status, application in (
                ("overdue", overdue),
                ("approaching", approaching),
                ("on_time", on_time),
            ):
                applications = ApplicationService.list_applications(
                    queue_status=status,
                )
                self.assertEqual(
                    list(applications.values_list("pk", flat=True)),
                    [application.pk],
                )
