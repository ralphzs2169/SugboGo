"""Focused priority ordering, queue parity, bounding, privacy, and authorization coverage."""

from datetime import datetime, time, timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import DatabaseError, connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.admin_operations.dashboard.priority_worklist_serializers import (
    PriorityWorklistSerializer,
)
from apps.admin_operations.dashboard.priority_worklist_service import (
    PriorityWorklistService,
)
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.admin_operations.moderation.services.reported_review_service import (
    ReportedReviewService,
)
from apps.business.models import Business
from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)
from apps.merchant_application.models import MerchantApplication, MerchantApplicationIdentity
from apps.merchant_application.utils.application_queue import (
    count_business_days,
    get_application_queue_aging_filters,
    get_business_day_cutoff,
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


class PriorityWorklistFixtures(DashboardFixtures):
    """Build pending records using the same persisted fields and shared aging rules as queues."""

    def aged_application(
        self,
        queue_status,
        hours_earlier=0,
    ):
        if queue_status == "on_time":
            submitted_at = self.NOW - timedelta(hours=1)
        else:
            thresholds = {
                "approaching": APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
                "overdue": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
            }
            cutoff = get_business_day_cutoff(
                thresholds[queue_status],
                reference_time=self.NOW,
            )
            submitted_at = datetime.combine(
                cutoff,
                time(hour=10),
                tzinfo=timezone.get_current_timezone(),
            )
        application = self.create_application(
            submitted_at=submitted_at - timedelta(hours=hours_earlier),
        )
        predicates = get_application_queue_aging_filters(reference_time=self.NOW)
        self.assertTrue(
            MerchantApplication.objects.filter(
                predicates[queue_status],
                pk=application.pk,
            ).exists(),
        )
        return application

    def change_request(
        self,
        work_type,
        timestamp,
        status="pending",
        business=None,
    ):
        if business is None:
            business = self.create_business()
        fields = {
            "BUSN_ID": business,
            "USER_ID": business.USER_ID,
        }
        if work_type == "business_name_change":
            return BusinessNameChangeRequest.objects.create(
                **fields,
                BNCR_STATUS=status,
                BNCR_PREVIOUS_BUSINESS_NAME="Old name",
                BNCR_PROPOSED_BUSINESS_NAME="Proposed name",
                BNCR_SUBMITTED_AT=timestamp,
            )
        if work_type == "classification_change":
            return BusinessClassificationChangeRequest.objects.create(
                **fields,
                BCCR_STATUS=status,
                PREVIOUS_CTGRY_ID=self.category,
                PROPOSED_CTGRY_ID=self.category,
                BCCR_PREVIOUS_CATEGORY_NAME=self.category.CTGRY_NAME,
                BCCR_PREVIOUS_CLUSTER_ID=self.cluster.pk,
                BCCR_PREVIOUS_CLUSTER_NAME=self.cluster.CLUS_NAME,
                BCCR_PROPOSED_CATEGORY_NAME=self.category.CTGRY_NAME,
                BCCR_PROPOSED_CLUSTER_ID=self.cluster.pk,
                BCCR_PROPOSED_CLUSTER_NAME=self.cluster.CLUS_NAME,
                BCCR_SUBMITTED_AT=timestamp,
            )
        return BusinessLocationChangeRequest.objects.create(
            **fields,
            BLCR_STATUS=status,
            BLCR_PREVIOUS_LOCT_ID=self.location.pk,
            BLCR_PREVIOUS_POINT=self.location.LOCT_POINT,
            BLCR_PREVIOUS_ADDRESS="Previous private address",
            BLCR_PREVIOUS_CITY="Cebu City",
            BLCR_PREVIOUS_PROVINCE="Cebu",
            BLCR_PROPOSED_POINT=Point(123.89, 10.32),
            BLCR_PROPOSED_ADDRESS="Proposed private address",
            BLCR_PROPOSED_CITY="Cebu City",
            BLCR_PROPOSED_PROVINCE="Cebu",
            BLCR_SUBMITTED_AT=timestamp,
        )

    def held_review(
        self,
        business,
        timestamp,
        **fields,
    ):
        review = self.create_review(
            business,
            status=Review.ReviewStatus.UNDER_REVIEW,
            **fields,
        )
        Review.objects.filter(pk=review.pk).update(REVW_CREATED_AT=timestamp)
        return review

    def pending_report(
        self,
        review,
        timestamp,
        status=ReviewReport.ReportStatus.PENDING,
    ):
        report = self.create_report(review, status=status)
        ReviewReport.objects.filter(pk=report.pk).update(RREP_CREATED_AT=timestamp)
        return report

    def dispute(
        self,
        business,
        timestamp,
        status=MerchantReviewDispute.DisputeStatus.PENDING,
    ):
        dispute = MerchantReviewDispute.objects.create(
            REVW_ID=self.create_review(business),
            BUSN_ID=business,
            USER_ID=business.USER_ID,
            MRDSP_STATUS=status,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
            MRDSP_DESCRIPTION="Private merchant dispute explanation",
        )
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            MRDSP_CREATED_AT=timestamp,
        )
        return dispute

    def serialized_worklist(self):
        return PriorityWorklistSerializer(
            PriorityWorklistService.get_worklist(),
        ).data


class PriorityWorklistServiceTests(PriorityWorklistFixtures, TestCase):
    """Protect explicit priority tiers, independent cases, and bounded safe projections."""

    def test_overdue_then_approaching_precede_older_other_work(self):
        oldest = self.aged_application("overdue", hours_earlier=2)
        newer = self.aged_application("overdue")
        approaching = self.aged_application("approaching")
        self.aged_application("on_time")
        old_request = self.change_request(
            "business_name_change",
            self.NOW - timedelta(days=100),
        )

        items = self.serialized_worklist()["items"]

        self.assertEqual(
            [item["id"] for item in items[:4]],
            [
                f"merchant_application:{oldest.pk}",
                f"merchant_application:{newer.pk}",
                f"merchant_application:{approaching.pk}",
                f"business_name_change:{old_request.pk}",
            ],
        )
        self.assertEqual(
            [item["priority"] for item in items],
            ["overdue", "overdue", "approaching", "pending", "pending"],
        )

    def test_oldest_approaching_items_fill_only_remaining_slots(self):
        overdue = self.aged_application("overdue")
        approaching = [
            self.aged_application("approaching", hours_earlier=index)
            for index in range(6)
        ]

        items = self.serialized_worklist()["items"]

        self.assertEqual(len(items), 5)
        self.assertEqual(items[0]["id"], f"merchant_application:{overdue.pk}")
        self.assertEqual(
            [item["entity"]["id"] for item in items[1:]],
            [application.pk for application in reversed(approaching[-4:])],
        )

    def test_five_overdue_items_short_circuit_lower_queues(self):
        applications = [
            self.aged_application("overdue", hours_earlier=index)
            for index in range(7)
        ]
        with (
            patch.object(
                PriorityWorklistService,
                "_change_request_candidates",
                side_effect=AssertionError("Lower queues should not be read"),
            ),
            self.assertNumQueries(2),
        ):
            items = self.serialized_worklist()["items"]

        self.assertEqual(
            [item["entity"]["id"] for item in items],
            [application.pk for application in reversed(applications[-5:])],
        )

    def test_on_time_and_all_change_types_merge_by_real_submission_time(self):
        application = self.aged_application("on_time")
        expected = []
        for index, work_type in enumerate((
            "business_name_change",
            "classification_change",
            "location_change",
        )):
            request = self.change_request(
                work_type,
                self.NOW - timedelta(days=3 - index),
            )
            expected.append(f"{work_type}:{request.pk}")
        expected.append(f"merchant_application:{application.pk}")

        items = self.serialized_worklist()["items"]

        self.assertEqual([item["id"] for item in items], expected)
        self.assertEqual(items[-1]["application_aging"]["status"], "on_time")
        self.assertEqual(items[-1]["application_aging"]["business_days"], 0)
        self.assertTrue(all(item["priority"] == "pending" for item in items))

    def test_nonpending_applications_changes_reviews_and_disputes_are_excluded(self):
        business = self.create_business()
        for status in MerchantApplication.ApplicationStatus.values:
            if status != MerchantApplication.ApplicationStatus.SUBMITTED:
                self.create_application(
                    status=status,
                    submitted_at=self.NOW - timedelta(days=30),
                )
        for work_type, model, _ in PriorityWorklistService.CHANGE_REQUESTS:
            for status in model.Status.values:
                if status != model.Status.PENDING:
                    self.change_request(
                        work_type,
                        self.NOW,
                        status=status,
                        business=business,
                    )
        for status in Review.ReviewStatus.values:
            if status != Review.ReviewStatus.UNDER_REVIEW:
                self.create_review(business, status=status)
        for status in MerchantReviewDispute.DisputeStatus.values:
            if status != MerchantReviewDispute.DisputeStatus.PENDING:
                self.dispute(business, self.NOW, status=status)

        self.assertEqual(self.serialized_worklist()["items"], [])

    def test_under_review_includes_automatic_processing_and_uses_creation_time(self):
        business = self.create_business()
        timestamp = self.NOW - timedelta(days=3)
        review = self.held_review(
            business,
            timestamp,
            REVW_MODERATION_DATA={"outcome": "pending_initial"},
        )
        Review.objects.filter(pk=review.pk).update(REVW_UPDATED_AT=self.NOW)

        item = self.serialized_worklist()["items"][0]

        self.assertEqual(item["id"], f"under_review:{review.pk}")
        self.assertEqual(item["status"], Review.ReviewStatus.UNDER_REVIEW)
        self.assertEqual(parse_datetime(item["timestamp"]), timestamp)
        self.assertNotIn("manual", item["title"].lower())

    def test_reported_cases_group_pending_reports_and_use_first_pending_timestamp(self):
        business = self.create_business()
        multiple = self.create_review(business)
        single = self.create_review(business, status=Review.ReviewStatus.REJECTED)
        first_pending = self.NOW - timedelta(days=2)
        self.pending_report(multiple, first_pending)
        self.pending_report(multiple, self.NOW - timedelta(days=1))
        self.pending_report(multiple, self.NOW - timedelta(hours=2))
        self.pending_report(single, self.NOW - timedelta(hours=1))
        for status in ReviewReport.ReportStatus.values:
            if status != ReviewReport.ReportStatus.PENDING:
                self.pending_report(
                    multiple,
                    self.NOW - timedelta(days=100),
                    status=status,
                )

        items = self.serialized_worklist()["items"]

        self.assertEqual(len(items), 2)
        self.assertEqual([item["pending_report_count"] for item in items], [3, 1])
        self.assertEqual(parse_datetime(items[0]["timestamp"]), first_pending)
        self.assertEqual(
            [item["entity"]["id"] for item in items],
            list(
                ReportedReviewService.list_reviews({"ordering": "oldest"})
                .values_list("REVW_ID", flat=True)
            ),
        )

    def test_resolved_reports_alone_do_not_create_work_items(self):
        business = self.create_business()
        review = self.create_review(business)
        for status in ReviewReport.ReportStatus.values:
            if status != ReviewReport.ReportStatus.PENDING:
                self.pending_report(review, self.NOW, status=status)

        self.assertEqual(self.serialized_worklist()["items"], [])

    def test_held_and_reported_workflows_remain_separate_for_same_review(self):
        business = self.create_business()
        review = self.held_review(business, self.NOW - timedelta(days=2))
        self.pending_report(review, self.NOW - timedelta(days=1))

        items = self.serialized_worklist()["items"]

        self.assertEqual(
            [item["id"] for item in items],
            [f"under_review:{review.pk}", f"reported_review:{review.pk}"],
        )
        self.assertEqual(items[0]["entity"]["id"], items[1]["entity"]["id"])

    def test_pending_dispute_uses_case_creation_not_review_creation_or_update(self):
        business = self.create_business()
        timestamp = self.NOW - timedelta(days=2)
        dispute = self.dispute(business, timestamp)
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            MRDSP_UPDATED_AT=self.NOW,
        )

        item = self.serialized_worklist()["items"][0]

        self.assertEqual(item["id"], f"review_dispute:{dispute.pk}")
        self.assertEqual(parse_datetime(item["timestamp"]), timestamp)

    def test_unknown_age_applications_remain_lowest_tier_with_deterministic_undated_fallback(self):
        missing = self.create_application()
        future = self.create_application(submitted_at=self.NOW + timedelta(days=1))
        inconsistent = self.create_application(
            submitted_at=self.NOW - timedelta(days=20),
            reviewed_at=self.NOW,
        )
        request = self.change_request("business_name_change", self.NOW)

        items = self.serialized_worklist()["items"]

        self.assertEqual(
            [item["id"] for item in items],
            [
                f"merchant_application:{inconsistent.pk}",
                f"business_name_change:{request.pk}",
                f"merchant_application:{missing.pk}",
                f"merchant_application:{future.pk}",
            ],
        )
        for item in items:
            self.assertEqual(item["priority"], "pending")
            if item["type"] == "merchant_application":
                self.assertEqual(
                    item["application_aging"],
                    {"status": "unknown_age", "business_days": None},
                )
        self.assertIsNone(items[-1]["timestamp"])
        self.assertIsNone(items[-1]["timestamp_source"])

    def test_aging_metadata_matches_shared_predicates_and_weekday_calculation(self):
        applications = {
            status: self.aged_application(status)
            for status in ("overdue", "approaching", "on_time")
        }
        predicates = get_application_queue_aging_filters(reference_time=self.NOW)

        items = self.serialized_worklist()["items"]

        for item in items:
            status = item["application_aging"]["status"]
            application = applications[status]
            self.assertTrue(
                MerchantApplication.objects.filter(
                    predicates[status],
                    pk=item["entity"]["id"],
                ).exists(),
            )
            self.assertEqual(
                item["application_aging"]["business_days"],
                count_business_days(application.MAPP_SUBMITTED_AT, self.NOW),
            )

    def test_tied_times_use_stable_type_then_numeric_entity_id(self):
        business = self.create_business()
        name = self.change_request(
            "business_name_change",
            self.NOW,
            business=business,
        )
        classification = self.change_request(
            "classification_change",
            self.NOW,
            business=business,
        )
        location = self.change_request(
            "location_change",
            self.NOW,
            business=business,
        )
        first = self.held_review(business, self.NOW)
        second = self.held_review(business, self.NOW)

        items = self.serialized_worklist()["items"]

        self.assertEqual(
            [item["id"] for item in items],
            [
                f"business_name_change:{name.pk}",
                f"classification_change:{classification.pk}",
                f"location_change:{location.pk}",
                f"under_review:{first.pk}",
                f"under_review:{second.pk}",
            ],
        )
        self.assertEqual(items, self.serialized_worklist()["items"])

    def test_current_labels_and_application_identity_fallback_are_safe(self):
        application = self.aged_application("on_time")
        MerchantApplicationIdentity.objects.create(
            MAPP_ID=application,
            CLUS_ID=self.cluster,
            CTGRY_ID=self.category,
            MIDN_BUSINESS_NAME="Application bakery",
            MIDN_CONTACT_NUMBER="private-contact",
            MIDN_REPRESENTATIVE_NAME="Private representative",
            MIDN_REPRESENTATIVE_ROLE=MerchantApplicationIdentity.RepresentativeRole.OWNER,
        )
        business = self.create_business()
        request = self.change_request("location_change", self.NOW, business=business)
        Business.objects.filter(pk=business.pk).update(BUSN_NAME="Renamed business")

        items = self.serialized_worklist()["items"]

        labels = {
            item["id"]: item["entity"]["label"]
            for item in items
        }
        self.assertEqual(
            labels[f"merchant_application:{application.pk}"],
            "Application bakery",
        )
        self.assertEqual(labels[f"location_change:{request.pk}"], "Renamed business")

    def test_missing_labels_do_not_break_real_pending_work(self):
        application = self.aged_application("on_time")
        business = self.create_business()
        dispute = self.dispute(business, self.NOW)
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(BUSN_ID=None)

        items = self.serialized_worklist()["items"]

        self.assertEqual(items[0]["entity"]["label"], f"Application #{application.pk}")
        self.assertEqual(items[1]["entity"]["label"], "Business unavailable")

    def test_sensitive_fields_and_internal_hydration_ids_are_not_serialized(self):
        business = self.create_business()
        review = self.held_review(
            business,
            self.NOW,
            REVW_INSTALLATION_ID="private-review-device",
            REVW_MODERATION_DATA={"fingerprint": "private-fingerprint"},
            REVW_MODERATION_NOTES="Private moderation notes",
        )
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Private held content")
        report = self.pending_report(review, self.NOW)
        ReviewReport.objects.filter(pk=report.pk).update(
            RREP_INSTALLATION_ID="private-reporter-device",
            RREP_NOTES="Private report notes",
            RREP_EXPLANATION="Private reporter explanation",
        )
        self.dispute(business, self.NOW)
        self.change_request("location_change", self.NOW, business=business)

        items = self.serialized_worklist()["items"]
        serialized = str(items)

        expected_fields = {
            "id",
            "type",
            "title",
            "status",
            "timestamp",
            "timestamp_source",
            "priority",
            "entity",
            "application_aging",
            "pending_report_count",
        }
        for item in items:
            self.assertEqual(set(item), expected_fields)
            self.assertEqual(set(item["entity"]), {"id", "label"})
        for private_value in (
            "Private held content",
            "private-review-device",
            "private-fingerprint",
            "Private moderation notes",
            "private-reporter-device",
            "Private report notes",
            "Private reporter explanation",
            "Private merchant dispute explanation",
            "Previous private address",
            "Proposed private address",
            business.USER_ID.USER_EMAIL,
            business.BUSN_CONTACT_NUMBER,
            "_business_id",
        ):
            self.assertNotIn(private_value, serialized)

    def test_candidates_are_sql_bounded_and_final_labels_use_two_batch_queries(self):
        self.aged_application("on_time")
        business = self.create_business()
        for index in range(6):
            for work_type, _, _ in PriorityWorklistService.CHANGE_REQUESTS:
                self.change_request(work_type, self.NOW - timedelta(minutes=30 - index))
            review = self.held_review(business, self.NOW)
            self.pending_report(review, self.NOW)
            self.dispute(business, self.NOW)

        with CaptureQueriesContext(connection) as queries:
            items = self.serialized_worklist()["items"]

        self.assertEqual(len(items), 5)
        self.assertEqual(len(queries), 11)
        for query in list(queries)[:9]:
            self.assertIn("LIMIT 5", query["sql"])

    def test_any_queried_source_failure_fails_instead_of_silently_omitting_work(self):
        for model in (
            MerchantApplication,
            BusinessNameChangeRequest,
            BusinessClassificationChangeRequest,
            BusinessLocationChangeRequest,
            Review,
            ReviewReport,
            MerchantReviewDispute,
        ):
            with (
                self.subTest(source=model.__name__),
                patch.object(
                    model.objects,
                    "filter",
                    side_effect=DatabaseError("Worklist source unavailable"),
                ),
            ):
                with self.assertRaisesMessage(
                    DatabaseError,
                    "Worklist source unavailable",
                ):
                    PriorityWorklistService.get_worklist()


class PriorityWorklistViewTests(
    PriorityWorklistFixtures,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Protect the independent API contract and existing active-administrator permissions."""

    def test_admin_and_super_admin_receive_valid_empty_worklist(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                self.client.force_authenticate(
                    user=self.create_user(role=role),
                )
                response = self.client.get(
                    reverse("admin-dashboard-priority-worklist"),
                )
                self.assertSuccessResponse(
                    response,
                    message="Dashboard priority worklist retrieved successfully.",
                )
                self.assertEqual(response.data["data"]["items"], [])
                self.assertEqual(parse_datetime(response.data["data"]["as_of"]), self.NOW)

    def test_endpoint_returns_real_pending_items_with_explicit_metadata(self):
        application = self.aged_application("overdue")
        self.client.force_authenticate(
            user=self.create_user(role=User.UserRole.ADMIN),
        )

        response = self.client.get(reverse("admin-dashboard-priority-worklist"))

        self.assertEqual(response.status_code, 200)
        item = response.data["data"]["items"][0]
        self.assertEqual(item["id"], f"merchant_application:{application.pk}")
        self.assertEqual(item["entity"]["id"], application.pk)
        self.assertEqual(item["priority"], "overdue")
        self.assertEqual(item["application_aging"]["status"], "overdue")

    def test_unauthorized_roles_and_inactive_administrators_are_rejected(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, status=status):
                self.client.force_authenticate(
                    user=self.create_user(role=role, status=status),
                )
                response = self.client.get(
                    reverse("admin-dashboard-priority-worklist"),
                )
                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(reverse("admin-dashboard-priority-worklist"))

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
