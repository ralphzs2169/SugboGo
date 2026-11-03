"""Directory inventory, PHT additions windows, request units, and permissions."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.business_overview_service import (
    BusinessOverviewService,
)
from apps.admin_operations.dashboard.services import DashboardSummaryService
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import Business
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.shared.analytics.date_ranges import MANILA
from apps.users.models import User


class BusinessOverviewServiceTests(DashboardFixtures, TestCase):
    """Protect population definitions and fixed-size SQL aggregation."""

    def create_at(
        self,
        created_at,
        status=Business.BusinessStatus.ACTIVE,
    ):
        business = self.create_business(status=status)
        Business.objects.filter(pk=business.pk).update(
            BUSN_CREATED_AT=created_at,
        )
        return business

    def test_inventory_uses_business_status_and_includes_unknown_records(self):
        self.create_business()
        self.create_business(status=Business.BusinessStatus.SUSPENDED)
        self.create_business(owner_status=User.UserStatus.SUSPENDED)
        self.create_business(status="legacy")
        self.create_application()

        with self.assertNumQueries(5):
            result = BusinessOverviewService.get_overview()

        self.assertEqual(result["business_status"], {
            "total": 4,
            "active": 2,
            "suspended": 1,
            "unknown_status": 1,
        })
        self.assertEqual(
            result["business_status"],
            DashboardSummaryService.get_summary()["business_status"],
        )

    def test_additions_use_half_open_pht_month_and_equal_previous_elapsed_window(self):
        start = datetime(2026, 11, 1, tzinfo=MANILA)
        previous_start = datetime(2026, 10, 1, tzinfo=MANILA)
        elapsed = self.NOW - start
        previous_end = previous_start + elapsed
        self.create_at(start - timedelta(microseconds=1))
        self.create_at(start)
        self.create_at(
            self.NOW - timedelta(microseconds=1),
            status=Business.BusinessStatus.SUSPENDED,
        )
        self.create_at(self.NOW)
        self.create_at(self.NOW + timedelta(seconds=1))
        self.create_at(previous_start)
        self.create_at(previous_end)
        result = BusinessOverviewService.get_overview()["new_businesses"]
        self.assertEqual(result["count"], 2)
        self.assertEqual(result["previous_count"], 1)
        self.assertEqual(result["difference"], 1)
        self.assertTrue(result["comparison_available"])
        self.assertEqual(result["period_start"], start.astimezone(UTC))
        self.assertEqual(result["period_end"], self.NOW)
        self.assertEqual(result["previous_period_end"], previous_end.astimezone(UTC))
        self.assertEqual(result["timezone"], "Asia/Manila")

    def test_zero_baseline_and_fewer_additions_are_absolute_counts(self):
        empty = BusinessOverviewService.get_overview()["new_businesses"]
        self.assertEqual(empty["count"], 0)
        self.assertEqual(empty["previous_count"], 0)
        self.assertEqual(empty["difference"], 0)
        self.create_at(datetime(2026, 11, 2, tzinfo=MANILA))
        self.assertEqual(
            BusinessOverviewService.get_overview()["new_businesses"]["difference"],
            1,
        )
        for day in (1, 2, 3):
            self.create_at(datetime(2026, 10, day, tzinfo=MANILA))
        self.assertEqual(
            BusinessOverviewService.get_overview()["new_businesses"]["difference"],
            -2,
        )

    def test_month_lengths_leap_year_year_rollover_and_empty_first_instant(self):
        cases = (
            (datetime(2026, 1, 2, 12, tzinfo=MANILA), True, 12),
            (datetime(2026, 3, 28, 23, tzinfo=MANILA), True, 2),
            (datetime(2026, 3, 29, tzinfo=MANILA), True, 2),
            (datetime(2026, 3, 29, 1, tzinfo=MANILA), False, 2),
            (datetime(2028, 3, 29, 23, tzinfo=MANILA), True, 2),
            (datetime(2028, 3, 30, 1, tzinfo=MANILA), False, 2),
            (datetime(2026, 11, 1, tzinfo=MANILA), True, 10),
        )
        for captured, available, previous_month in cases:
            with self.subTest(now=captured):
                with patch("django.utils.timezone.now", return_value=captured):
                    result = BusinessOverviewService.get_overview()["new_businesses"]
                self.assertEqual(result["count"], 0)
                self.assertEqual(result["comparison_available"], available)
                self.assertEqual(
                    result["previous_period_start"].astimezone(MANILA).month,
                    previous_month,
                )
                if available:
                    self.assertEqual(result["difference"], 0)
                    self.assertEqual(
                        result["period_end"] - result["period_start"],
                        result["previous_period_end"] - result["previous_period_start"],
                    )
                else:
                    self.assertIsNone(result["previous_count"])
                    self.assertIsNone(result["difference"])
                    self.assertIsNone(result["previous_period_end"])
                    self.assertEqual(result["comparison_reason"], "previous_month_shorter")

    def test_pending_counts_requests_including_three_types_for_one_suspended_business(self):
        business = self.create_business(status=Business.BusinessStatus.SUSPENDED)
        for status in BusinessNameChangeRequest.Status.values:
            BusinessNameChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BNCR_STATUS=status,
                BNCR_PREVIOUS_BUSINESS_NAME="Old",
                BNCR_PROPOSED_BUSINESS_NAME="New",
                BNCR_SUBMITTED_AT=self.NOW,
            )
        for status in BusinessClassificationChangeRequest.Status.values:
            BusinessClassificationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BCCR_STATUS=status,
                PREVIOUS_CTGRY_ID=self.category,
                PROPOSED_CTGRY_ID=self.category,
                BCCR_PREVIOUS_CATEGORY_NAME="Category",
                BCCR_PREVIOUS_CLUSTER_ID=self.cluster.pk,
                BCCR_PREVIOUS_CLUSTER_NAME="Cluster",
                BCCR_PROPOSED_CATEGORY_NAME="Category",
                BCCR_PROPOSED_CLUSTER_ID=self.cluster.pk,
                BCCR_PROPOSED_CLUSTER_NAME="Cluster",
                BCCR_SUBMITTED_AT=self.NOW,
            )
        for status in BusinessLocationChangeRequest.Status.values:
            BusinessLocationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BLCR_STATUS=status,
                BLCR_PREVIOUS_LOCT_ID=self.location.pk,
                BLCR_PREVIOUS_POINT=self.location.LOCT_POINT,
                BLCR_PREVIOUS_ADDRESS="Old",
                BLCR_PREVIOUS_CITY="Cebu City",
                BLCR_PREVIOUS_PROVINCE="Cebu",
                BLCR_PROPOSED_POINT=self.location.LOCT_POINT,
                BLCR_PROPOSED_ADDRESS="New",
                BLCR_PROPOSED_CITY="Cebu City",
                BLCR_PROPOSED_PROVINCE="Cebu",
                BLCR_SUBMITTED_AT=self.NOW,
            )
        self.create_application()
        result = BusinessOverviewService.get_overview()["change_requests"]
        self.assertEqual(result, {
            "pending_total": 3,
            "by_type": {
                "business_name": 1,
                "classification": 1,
                "location": 1,
            },
        })
        self.assertEqual(
            result,
            DashboardSummaryService.get_summary()["change_requests"],
        )


class BusinessOverviewViewTests(DashboardFixtures, APITestCase):
    """Protect the response envelope and administrative access boundary."""

    def test_admin_and_super_admin_can_read_overview(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.client.force_authenticate(self.create_user(role=role))
                response = self.client.get(reverse("admin-business-overview"))
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["success"])
                data = response.data["data"]
                self.assertEqual(set(data), {
                    "as_of", "business_status", "new_businesses", "change_requests",
                })
                self.assertEqual(data["business_status"]["total"], 0)
                self.assertEqual(data["new_businesses"]["count"], 0)
                self.assertEqual(data["new_businesses"]["difference"], 0)
                self.assertEqual(data["change_requests"]["pending_total"], 0)
                self.assertEqual(data["new_businesses"]["timezone"], "Asia/Manila")

    def test_anonymous_consumer_and_suspended_admin_are_denied(self):
        url = reverse("admin-business-overview")
        self.assertEqual(self.client.get(url).status_code, 401)
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            self.client.force_authenticate(self.create_user(role=role))
            self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.create_user(
            role=User.UserRole.ADMIN,
            status=User.UserStatus.SUSPENDED,
        ))
        self.assertEqual(self.client.get(url).status_code, 403)
