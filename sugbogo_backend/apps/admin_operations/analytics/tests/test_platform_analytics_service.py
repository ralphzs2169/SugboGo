"""SQL KPI definitions and independent MongoDB availability."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase

from apps.admin_operations.analytics.services.platform_analytics_service import PlatformAnalyticsService
from apps.business.models import Business, Category, Cluster, Location
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.merchant_application.models import MerchantApplication
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class PlatformAnalyticsServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.period = resolve_period(
            preset="custom", start_date="2026-10-05", end_date="2026-10-06",
            now=datetime(2026, 10, 12, tzinfo=UTC),
        )
        cluster = Cluster.objects.create(CLUS_NAME="Analytics cluster")
        category = Category.objects.create(CTGRY_NAME="Analytics category", CLUS_ID=cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31, srid=4326), LOCT_ADDRESS="Cebu City")
        for index, status, application_status, verified in (
            (1, Business.BusinessStatus.ACTIVE, MerchantApplication.ApplicationStatus.APPROVED, False),
            (2, Business.BusinessStatus.SUSPENDED, MerchantApplication.ApplicationStatus.APPROVED, False),
            (3, Business.BusinessStatus.ACTIVE, None, True),
            (4, Business.BusinessStatus.SUSPENDED, MerchantApplication.ApplicationStatus.REJECTED, False),
        ):
            owner = cls.create_user(f"owner-{index}", User.UserRole.MERCHANT, User.UserStatus.SUSPENDED)
            business = Business.objects.create(
                BUSN_NAME=f"Analytics business {index}", BUSN_CONTACT_NUMBER="09170000000",
                BUSN_STATUS=status, BUSN_IS_VERIFIED=verified,
                USER_ID=owner, CTGRY_ID=category, LOCT_ID=location,
            )
            if application_status is not None:
                MerchantApplication.objects.create(USER_ID=owner, BUSN_ID=business, MAPP_STATUS=application_status)
        # An approved application without a business must not count as approved inventory.
        applicant = cls.create_user("unlinked-applicant", User.UserRole.MERCHANT)
        MerchantApplication.objects.create(USER_ID=applicant, MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED)
        cls.explorers = []
        for index, status, moment in (
            (1, User.UserStatus.PENDING, cls.period.start),
            (2, User.UserStatus.SUSPENDED, cls.period.start + timedelta(hours=1)),
            (3, User.UserStatus.ACTIVE, cls.period.previous_start),
            (4, User.UserStatus.ACTIVE, cls.period.end),
        ):
            explorer = cls.create_user(f"explorer-{index}", User.UserRole.EXPLORER, status)
            User.objects.filter(pk=explorer.pk).update(USER_CREATED_AT=moment)
            cls.explorers.append(explorer)

    @staticmethod
    def create_user(name, role, status=User.UserStatus.ACTIVE):
        return User.objects.create_user(
            email=f"analytics-{name}@example.com", password=None,
            USER_ROLE=role, USER_STATUS=status, USER_REPUTATION=Decimal("0.20"),
            USER_FNAME="Analytics", USER_LNAME=name,
        )

    def overview(self, **mock_options):
        options = {"return_value": 3}
        options.update(mock_options)
        with patch.object(VisibilityEventService, "count_analytics_explorers", **options):
            return PlatformAnalyticsService.get_overview(self.period)

    def test_inventory_uses_status_and_approved_link_not_legacy_verified_flag(self):
        report = self.overview()
        self.assertEqual(report["kpis"]["active_businesses"]["value"], 2)
        self.assertEqual(report["kpis"]["approved_businesses"]["value"], 2)
        for key in ("active_businesses", "approved_businesses"):
            self.assertEqual(report["kpis"][key]["measurement_type"], "current_snapshot")
            self.assertIsNone(report["kpis"][key]["previous_value"])
            self.assertEqual(report["kpis"][key]["change"]["reason"], "historical_snapshot_unavailable")

    def test_registrations_include_all_statuses_and_use_exclusive_date_bounds(self):
        report = self.overview()
        registration = report["kpis"]["new_explorer_accounts"]
        self.assertEqual(registration["value"], 2)
        self.assertEqual(registration["previous_value"], 1)
        self.assertEqual(registration["change"]["value"], 100)
        weekly = report["new_explorer_accounts_weekly"]
        self.assertEqual([(row["date"], row["value"]) for row in weekly], [("2026-10-05", 2)])
        self.assertEqual(weekly[0]["start"], self.period.start.isoformat())
        self.assertEqual(weekly[0]["end_exclusive"], self.period.end.isoformat())

    def test_later_role_change_is_current_state_reporting(self):
        User.objects.filter(pk=self.explorers[0].pk).update(USER_ROLE=User.UserRole.MERCHANT)
        report = self.overview()
        self.assertEqual(report["kpis"]["new_explorer_accounts"]["value"], 1)
        self.assertIn("Later role changes", report["kpis"]["new_explorer_accounts"]["description"])

    def test_mongo_failure_keeps_sql_counts_and_reports_null_visibility(self):
        report = self.overview(side_effect=VisibilityTrackingUnavailable())
        self.assertEqual(report["kpis"]["active_businesses"]["value"], 2)
        self.assertEqual(report["kpis"]["new_explorer_accounts"]["value"], 2)
        self.assertIsNone(report["kpis"]["discovery_active_explorers"]["value"])
        self.assertEqual(report["sources"]["visibility_current"]["availability"], "unavailable")
        self.assertTrue(report["sources"]["domain"]["coverage_verified"])
        self.assertIn("visibility_unavailable", report["meta"]["partial_reasons"])

    def test_prior_mongo_failure_preserves_current_discovery_value(self):
        report = self.overview(side_effect=[5, VisibilityTrackingUnavailable()])
        discovery = report["kpis"]["discovery_active_explorers"]
        self.assertEqual(discovery["value"], 5)
        self.assertIsNone(discovery["previous_value"])
        self.assertIsNone(discovery["change"]["value"])
        self.assertIn("not total app MAU", discovery["label"])

    def test_zero_registration_prior_count_returns_no_relative_comparison(self):
        User.objects.filter(pk=self.explorers[2].pk).update(USER_CREATED_AT=self.period.start)
        report = self.overview()
        registration = report["kpis"]["new_explorer_accounts"]
        self.assertEqual(registration["previous_value"], 0)
        self.assertIsNone(registration["change"]["value"])
        self.assertEqual(registration["change"]["reason"], "zero_previous_value")

    def test_empty_selected_period_returns_zero_registrations_not_null(self):
        empty_period = resolve_period(
            preset="custom", start_date="2026-09-01", end_date="2026-09-02",
            now=datetime(2026, 10, 12, tzinfo=UTC),
        )
        with patch.object(VisibilityEventService, "count_analytics_explorers", return_value=0):
            report = PlatformAnalyticsService.get_overview(empty_period)
        self.assertEqual(report["kpis"]["new_explorer_accounts"]["value"], 0)
        self.assertEqual(report["kpis"]["discovery_active_explorers"]["value"], 0)
        self.assertEqual(report["new_explorer_accounts_weekly"], [])
