"""Acquisition grouping parity with maintained Platform Growth populations."""

from datetime import timedelta
from unittest.mock import Mock

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.admin_operations.analytics.reporting_views import BusinessAcquisitionView
from apps.admin_operations.analytics.services.business_acquisition_service import BusinessAcquisitionService
from apps.admin_operations.analytics.services.platform_growth_service import PlatformGrowthService
from apps.business.models import Business, Category, Cluster
from apps.merchant_application.models import MerchantApplicationReview
from apps.users.models import User

from .reporting_fixtures import ReportingFixtures


class BusinessAcquisitionTests(ReportingFixtures, TestCase):
    """Test real SQL grouping with explicit period and chronology edge cases."""

    def test_empty_period_and_unclassified_rows(self):
        """Empty observations remain zero and unusable classifications are retained."""
        report = BusinessAcquisitionService.get_report(self.period)
        self.assertEqual(report["totals"], {"created": 0, "approved": 0})
        self.assertEqual(report["categories"], [])
        queryset = Mock()
        queryset.order_by.return_value.values.return_value.annotate.return_value = [
            {"identifier": None, "name": None, "count": 2},
            {"identifier": 1, "name": " ", "count": 1},
        ]
        self.assertEqual(
            BusinessAcquisitionService.grouped_counts(queryset, "identifier", "name"),
            {(None, "Unclassified"): 3},
        )

    def test_grouping_events_boundaries_current_taxonomy_and_growth_parity(self):
        """Creation and first approvals remain independent across both classifications."""
        early = self.make_business(created_at=self.period.start - timedelta(days=1))
        current = self.make_business(created_at=self.period.start)
        self.make_business(created_at=self.period.end)
        application = self.make_application(business=early)
        self.make_decision(
            application,
            self.period.start,
            decision=MerchantApplicationReview.Decision.APPROVED,
        )
        self.make_decision(
            application,
            self.period.start + timedelta(days=1),
            decision=MerchantApplicationReview.Decision.APPROVED,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Second cluster")
        category = Category.objects.create(CLUS_ID=cluster, CTGRY_NAME="Second category")
        Business.objects.filter(pk=current.pk).update(
            CTGRY_ID=category,
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        with self.assertNumQueries(4):
            report = BusinessAcquisitionService.get_report(self.period)
        growth = PlatformGrowthService.get_report(self.period)
        for group in ("categories", "clusters"):
            self.assertEqual(sum(row["created"] for row in report[group]), growth["activity"]["new_businesses"]["value"])
            self.assertEqual(sum(row["approved"] for row in report[group]), growth["activity"]["newly_approved_businesses"]["value"])
        self.assertEqual(report["totals"], {"created": 1, "approved": 1})
        second = next(row for row in report["categories"] if row["id"] == category.pk)
        self.assertEqual((second["created"], second["approved"]), (1, 0))

    def test_admin_permission_and_period_validation(self):
        """Only active administrators can read the standard aggregate envelope."""
        factory = APIRequestFactory()
        for role in User.UserRole.values:
            request = factory.get("/", {"period": "7"})
            force_authenticate(
                request,
                user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE),
            )
            response = BusinessAcquisitionView.as_view()(request)
            expected = 200 if role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN) else 403
            self.assertEqual(response.status_code, expected)
        request = factory.get("/", {"period": "custom", "start_date": "invalid"})
        force_authenticate(
            request,
            user=User(USER_ID=999, USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE),
        )
        self.assertEqual(BusinessAcquisitionView.as_view()(request).status_code, 400)

    def test_sparse_unclassified_business_and_approval_outside_period(self):
        """Unclassified businesses stay visible and later approvals are not first approvals."""
        business = self.make_business(created_at=self.period.start)
        Category.objects.filter(pk=business.CTGRY_ID_id).update(CTGRY_NAME=" ")
        application = self.make_application(business=business)
        self.make_decision(
            application,
            self.period.start - timedelta(seconds=1),
            decision=MerchantApplicationReview.Decision.APPROVED,
        )
        self.make_decision(
            application,
            self.period.start,
            decision=MerchantApplicationReview.Decision.APPROVED,
        )
        report = BusinessAcquisitionService.get_report(self.period)
        self.assertEqual(report["categories"], [{
            "id": None,
            "name": "Unclassified",
            "created": 1,
            "approved": 0,
        }])
        self.assertEqual(report["totals"], {"created": 1, "approved": 0})
