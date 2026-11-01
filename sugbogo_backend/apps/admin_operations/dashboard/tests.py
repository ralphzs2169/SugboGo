"""Focused operational summary, queue parity, and Dashboard authorization tests."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.admin_operations.dashboard.services import DashboardSummaryService
from apps.admin_operations.moderation.services.reported_review_service import (
    ReportedReviewService,
)
from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.utils.application_queue import (
    count_business_days,
    get_application_queue_status,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class DashboardFixtures:
    """Create only persisted records used by the Dashboard's SQL queries."""

    NOW = datetime(2026, 11, 6, 12, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Dashboard cluster",
        )
        cls.category = Category.objects.create(
            CLUS_ID=cls.cluster,
            CTGRY_NAME="Dashboard category",
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.88, 10.31),
            LOCT_ADDRESS="Cebu",
        )

    def setUp(self):
        super().setUp()
        clock = patch(
            "django.utils.timezone.now",
            return_value=self.NOW,
        )
        clock.start()
        self.addCleanup(clock.stop)
        zone = timezone.override("UTC")
        zone.__enter__()
        self.addCleanup(zone.__exit__, None, None, None)

    def create_user(
        self,
        role=User.UserRole.EXPLORER,
        status=User.UserStatus.ACTIVE,
    ):
        return User.objects.create(
            USER_EMAIL=f"dashboard-{User.objects.count()}@example.com",
            USER_FNAME="Dashboard",
            USER_LNAME="User",
            USER_ROLE=role,
            USER_STATUS=status,
            password="!",
        )

    def create_business(
        self,
        status=Business.BusinessStatus.ACTIVE,
        owner_status=User.UserStatus.ACTIVE,
        owner_role=User.UserRole.MERCHANT,
        verified=False,
    ):
        return Business.objects.create(
            USER_ID=self.create_user(
                role=owner_role,
                status=owner_status,
            ),
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
            BUSN_NAME="Dashboard business",
            BUSN_CONTACT_NUMBER="09170000000",
            BUSN_STATUS=status,
            BUSN_IS_VERIFIED=verified,
        )

    def create_application(
        self,
        status=MerchantApplication.ApplicationStatus.SUBMITTED,
        submitted_at=None,
        reviewed_at=None,
    ):
        return MerchantApplication.objects.create(
            USER_ID=self.create_user(),
            MAPP_STATUS=status,
            MAPP_SUBMITTED_AT=submitted_at,
            MAPP_REVIEWED_AT=reviewed_at,
        )

    def create_review(
        self,
        business,
        status=Review.ReviewStatus.PUBLISHED,
        **fields,
    ):
        return Review.objects.create(
            USER_ID=self.create_user(),
            BUSN_ID=business,
            REVW_TEXT="Dashboard review",
            REVW_STATUS=status,
            **fields,
        )

    def create_report(
        self,
        review,
        status=ReviewReport.ReportStatus.PENDING,
    ):
        return ReviewReport.objects.create(
            USER_ID=self.create_user(),
            REVW_ID=review,
            RREP_TYPE=ReviewReport.ReportType.SPAM,
            RREP_STATUS=status,
        )


@override_settings(TIME_ZONE="UTC")
class DashboardSummaryServiceTests(DashboardFixtures, TestCase):
    """Protect exact operational count definitions and efficient query behavior."""

    def test_applications_count_only_submitted_status(self):
        for status in MerchantApplication.ApplicationStatus.values:
            self.create_application(
                status=status,
                submitted_at=self.NOW,
            )

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["applications"]["pending_review"], 1)
        self.assertEqual(result["applications"]["aging"]["on_time"], 1)

    def test_pending_change_requests_count_requests_by_type(self):
        business = self.create_business()
        for status in BusinessNameChangeRequest.Status.values:
            BusinessNameChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BNCR_STATUS=status,
                BNCR_PREVIOUS_BUSINESS_NAME="Old name",
                BNCR_PROPOSED_BUSINESS_NAME="New name",
                BNCR_SUBMITTED_AT=self.NOW,
            )
        for status in BusinessClassificationChangeRequest.Status.values:
            BusinessClassificationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BCCR_STATUS=status,
                PREVIOUS_CTGRY_ID=self.category,
                PROPOSED_CTGRY_ID=self.category,
                BCCR_PREVIOUS_CATEGORY_NAME=self.category.CTGRY_NAME,
                BCCR_PREVIOUS_CLUSTER_ID=self.cluster.pk,
                BCCR_PREVIOUS_CLUSTER_NAME=self.cluster.CLUS_NAME,
                BCCR_PROPOSED_CATEGORY_NAME=self.category.CTGRY_NAME,
                BCCR_PROPOSED_CLUSTER_ID=self.cluster.pk,
                BCCR_PROPOSED_CLUSTER_NAME=self.cluster.CLUS_NAME,
                BCCR_SUBMITTED_AT=self.NOW,
            )
        for status in BusinessLocationChangeRequest.Status.values:
            BusinessLocationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BLCR_STATUS=status,
                BLCR_PREVIOUS_LOCT_ID=self.location.pk,
                BLCR_PREVIOUS_POINT=self.location.LOCT_POINT,
                BLCR_PREVIOUS_ADDRESS="Old address",
                BLCR_PREVIOUS_CITY="Cebu City",
                BLCR_PREVIOUS_PROVINCE="Cebu",
                BLCR_PROPOSED_POINT=Point(123.89, 10.32),
                BLCR_PROPOSED_ADDRESS="New address",
                BLCR_PROPOSED_CITY="Cebu City",
                BLCR_PROPOSED_PROVINCE="Cebu",
                BLCR_SUBMITTED_AT=self.NOW,
            )

        result = DashboardSummaryService.get_summary()["change_requests"]

        self.assertEqual(
            result["by_type"],
            {
                "business_name": 1,
                "classification": 1,
                "location": 1,
            },
        )
        self.assertEqual(result["pending_total"], 3)
        self.assertEqual(
            result["pending_total"],
            sum(result["by_type"].values()),
        )

    def test_reviews_count_under_review_including_automatic_checks(self):
        business = self.create_business()
        for status in Review.ReviewStatus.values:
            self.create_review(
                business,
                status=status,
            )
        self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={"outcome": "pending_initial"},
        )
        self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={"outcome": "provider_failure"},
        )

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["reviews_under_review"], 3)

    def test_reported_cases_group_pending_reports_without_threshold(self):
        business = self.create_business()
        multiple = self.create_review(business)
        single = self.create_review(
            business,
            status=Review.ReviewStatus.REJECTED,
        )
        resolved = self.create_review(business)
        for _ in range(3):
            self.create_report(multiple)
        self.create_report(single)
        for status in ReviewReport.ReportStatus.values:
            if status != ReviewReport.ReportStatus.PENDING:
                self.create_report(
                    resolved,
                    status=status,
                )

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["reported_review_cases"], 2)
        self.assertEqual(
            result["reported_review_cases"],
            ReportedReviewService.list_reviews({}).count(),
        )

    def test_review_can_belong_to_both_held_and_reported_queues(self):
        business = self.create_business()
        review = self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
        )
        self.create_report(review)

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["reviews_under_review"], 1)
        self.assertEqual(result["reported_review_cases"], 1)
        self.assertNotIn("total_outstanding_issues", result)

    def test_disputes_count_only_pending_status(self):
        business = self.create_business()
        for status in MerchantReviewDispute.DisputeStatus.values:
            MerchantReviewDispute.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                REVW_ID=self.create_review(business),
                MRDSP_STATUS=status,
                MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
                MRDSP_DESCRIPTION="Please investigate this review.",
            )

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["pending_disputes"], 1)

    def test_active_businesses_ignore_owner_status_role_and_verification(self):
        for owner_status in User.UserStatus.values:
            self.create_business(
                owner_status=owner_status,
            )
        self.create_business(
            owner_role=User.UserRole.EXPLORER,
            verified=True,
        )
        self.create_business(
            status=Business.BusinessStatus.SUSPENDED,
            verified=True,
        )

        result = DashboardSummaryService.get_summary()

        self.assertEqual(result["active_businesses"], 5)
        self.assertEqual(
            result["business_status"],
            {"active": 5, "suspended": 1, "unknown_status": 0, "total": 6},
        )

    def test_business_status_handles_single_status_and_unrecognized_records(self):
        suspended = self.create_business(
            status=Business.BusinessStatus.SUSPENDED,
            owner_status=User.UserStatus.DISABLED,
        )
        result = DashboardSummaryService.get_summary()
        self.assertEqual(result["active_businesses"], 0)
        self.assertEqual(
            result["business_status"],
            {"active": 0, "suspended": 1, "unknown_status": 0, "total": 1},
        )
        Business.objects.filter(pk=suspended.pk).update(BUSN_STATUS="legacy")
        self.assertEqual(
            DashboardSummaryService.get_summary()["business_status"],
            {"active": 0, "suspended": 0, "unknown_status": 1, "total": 1},
        )

    def test_business_status_query_failure_is_not_replaced_with_zero(self):
        with patch.object(
            Business.objects,
            "aggregate",
            side_effect=DatabaseError("Business inventory unavailable"),
        ):
            with self.assertRaises(DatabaseError):
                DashboardSummaryService.get_summary()

    def test_application_aging_boundaries_match_existing_queue_statuses(self):
        # Friday reference: weekend submissions have five elapsed weekdays.
        cases = (
            (datetime(2026, 11, 6, 10, tzinfo=UTC), "on_time"),
            (datetime(2026, 11, 5, 10, tzinfo=UTC), "on_time"),
            (datetime(2026, 11, 4, 10, tzinfo=UTC), "on_time"),
            (datetime(2026, 11, 3, 10, tzinfo=UTC), "approaching"),
            (datetime(2026, 11, 2, 10, tzinfo=UTC), "approaching"),
            (datetime(2026, 11, 1, 10, tzinfo=UTC), "overdue"),
            (datetime(2026, 10, 31, 10, tzinfo=UTC), "overdue"),
            (datetime(2026, 10, 30, 10, tzinfo=UTC), "overdue"),
            (datetime(2026, 10, 29, 10, tzinfo=UTC), "overdue"),
        )
        expected = {"on_time": set(), "approaching": set(), "overdue": set()}
        for submitted_at, queue_status in cases:
            application = self.create_application(
                submitted_at=submitted_at,
            )
            expected[queue_status].add(application.pk)
            self.assertEqual(
                get_application_queue_status(submitted_at),
                queue_status,
            )
        for status in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.APPROVED,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            self.create_application(
                status=status,
                submitted_at=self.NOW - timedelta(days=30),
            )

        result = DashboardSummaryService.get_summary()["applications"]

        self.assertEqual(result["pending_review"], len(cases))
        self.assertEqual(result["aging"]["unknown_age"], 0)
        for queue_status, expected_ids in expected.items():
            with self.subTest(queue_status=queue_status):
                actual_ids = set(
                    ApplicationService.list_applications(
                        queue_status=queue_status,
                    ).values_list("MAPP_ID", flat=True)
                )
                self.assertEqual(actual_ids, expected_ids)
                self.assertEqual(
                    result["aging"][queue_status],
                    len(actual_ids),
                )

    def test_weekend_reference_dates_do_not_add_elapsed_weekdays(self):
        submitted_at = datetime(2026, 11, 4, 10, tzinfo=UTC)
        application = self.create_application(
            submitted_at=submitted_at,
        )
        approaching = self.create_application(
            submitted_at=datetime(2026, 11, 3, 10, tzinfo=UTC),
        )
        overdue = self.create_application(
            submitted_at=datetime(2026, 11, 1, 10, tzinfo=UTC),
        )
        for reference_time in (
            datetime(2026, 11, 7, 12, tzinfo=UTC),
            datetime(2026, 11, 8, 12, tzinfo=UTC),
        ):
            with (
                self.subTest(reference_time=reference_time),
                patch("django.utils.timezone.now", return_value=reference_time),
            ):
                result = DashboardSummaryService.get_summary()["applications"]
                self.assertEqual(
                    count_business_days(submitted_at, reference_time),
                    2,
                )
                self.assertEqual(result["aging"]["on_time"], 1)
                self.assertEqual(result["aging"]["approaching"], 1)
                self.assertEqual(result["aging"]["overdue"], 1)
                expected = {
                    "on_time": {application.pk},
                    "approaching": {approaching.pk},
                    "overdue": {overdue.pk},
                }
                for queue_status, expected_ids in expected.items():
                    actual_ids = set(
                        ApplicationService.list_applications(
                            queue_status=queue_status,
                        ).values_list("MAPP_ID", flat=True)
                    )
                    self.assertEqual(actual_ids, expected_ids)
                    self.assertEqual(
                        result["aging"][queue_status],
                        len(actual_ids),
                    )

    def test_missing_future_and_inconsistent_times_remain_unclassified(self):
        self.create_application()
        self.create_application(
            submitted_at=self.NOW + timedelta(seconds=1),
        )
        self.create_application(
            submitted_at=self.NOW + timedelta(days=1),
        )
        self.create_application(
            submitted_at=self.NOW - timedelta(days=10),
            reviewed_at=self.NOW,
        )
        self.assertIsNone(get_application_queue_status(None))
        self.assertIsNone(
            get_application_queue_status(self.NOW + timedelta(seconds=1)),
        )

        result = DashboardSummaryService.get_summary()["applications"]

        self.assertEqual(result["pending_review"], 4)
        self.assertEqual(
            result["aging"],
            {
                "on_time": 0,
                "approaching": 0,
                "overdue": 0,
                "unknown_age": 4,
            },
        )
        for queue_status in ("on_time", "approaching", "overdue"):
            self.assertFalse(
                ApplicationService.list_applications(
                    queue_status=queue_status,
                ).exists(),
            )

    def test_summary_uses_eight_database_aggregation_queries(self):
        with self.assertNumQueries(8):
            DashboardSummaryService.get_summary()

    def test_query_failure_is_not_replaced_with_zero(self):
        with patch.object(
            ReviewReport.objects,
            "filter",
            side_effect=DatabaseError("Reporting query failed"),
        ):
            with self.assertRaisesMessage(DatabaseError, "Reporting query failed"):
                DashboardSummaryService.get_summary()


@override_settings(TIME_ZONE="UTC")
class DashboardSummaryViewTests(
    DashboardFixtures,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Protect the live response envelope and existing server-side role enforcement."""

    def test_admin_and_super_admin_receive_zero_summary_with_valid_as_of(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.client.force_authenticate(
                    user=self.create_user(role=role),
                )
                response = self.client.get(reverse("get_dashboard_data"))

                self.assertSuccessResponse(
                    response,
                    message="Dashboard summary retrieved successfully.",
                )
                data = response.data["data"]
                self.assertEqual(parse_datetime(data["as_of"]), self.NOW)
                self.assertTrue(timezone.is_aware(parse_datetime(data["as_of"])))
                self.assertEqual(
                    data,
                    {
                        "as_of": data["as_of"],
                        "applications": {
                            "pending_review": 0,
                            "aging": {
                                "on_time": 0,
                                "approaching": 0,
                                "overdue": 0,
                                "unknown_age": 0,
                            },
                        },
                        "change_requests": {
                            "pending_total": 0,
                            "by_type": {
                                "business_name": 0,
                                "classification": 0,
                                "location": 0,
                            },
                        },
                        "reviews_under_review": 0,
                        "reported_review_cases": 0,
                        "pending_disputes": 0,
                        "active_businesses": 0,
                        "business_status": {
                            "active": 0,
                            "suspended": 0,
                            "unknown_status": 0,
                            "total": 0,
                        },
                    },
                )

    def test_endpoint_returns_live_counts(self):
        business = self.create_business()
        review = self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
        )
        self.create_report(review)
        self.create_application(submitted_at=self.NOW)
        self.client.force_authenticate(
            user=self.create_user(role=User.UserRole.ADMIN),
        )

        response = self.client.get(reverse("get_dashboard_data"))

        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["applications"]["pending_review"], 1)
        self.assertEqual(data["applications"]["aging"]["on_time"], 1)
        self.assertEqual(data["reviews_under_review"], 1)
        self.assertEqual(data["reported_review_cases"], 1)
        self.assertEqual(data["active_businesses"], 1)
        self.assertEqual(
            data["business_status"],
            {"active": 1, "suspended": 0, "unknown_status": 0, "total": 1},
        )

    def test_unauthorized_roles_and_inactive_admins_are_rejected(self):
        cases = (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        )
        for role, status in cases:
            with self.subTest(role=role, status=status):
                self.client.force_authenticate(
                    user=self.create_user(role=role, status=status),
                )
                response = self.client.get(reverse("get_dashboard_data"))

                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(reverse("get_dashboard_data"))

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
