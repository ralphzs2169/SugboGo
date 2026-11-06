from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.paginator import Paginator
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.unified_activity_service import (
    UnifiedActivityService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.models import User


class UnifiedMerchantActivityTests(TestCase):
    """Cover retained merchant occurrences and their administrative or automatic resolutions."""

    REQUESTS = {
        "business_name_change": (BusinessNameChangeRequest, "BNCR"),
        "business_classification_change": (BusinessClassificationChangeRequest, "BCCR"),
        "business_location_change": (BusinessLocationChangeRequest, "BLCR"),
    }

    @classmethod
    def setUpTestData(cls):
        """Build source identities without invoking unrelated domain write side effects."""
        AnalyticsPolicyChange.objects.all().delete()
        cls.now = timezone.now().replace(microsecond=0)
        cls.merchant = User.objects.create(
            USER_EMAIL="unified-requester@example.com",
            USER_FNAME="Current",
            USER_LNAME="Requester",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.DISABLED,
            password="!",
        )
        cls.admin = User.objects.create(
            USER_EMAIL="unified-reviewer@example.com",
            USER_FNAME="Current",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.author = User.objects.create(
            USER_EMAIL="unified-review-author@example.com",
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.cluster = Cluster.objects.create(CLUS_NAME="Unified Requests")
        cls.category = Category.objects.create(
            CLUS_ID=cls.cluster,
            CTGRY_NAME="Request Category",
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.9, 10.3, srid=4326),
            LOCT_ADDRESS="Current address",
        )
        cls.business = Business.objects.create(
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
            BUSN_NAME="Current business name",
            BUSN_CONTACT_NUMBER="09123456789",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        cls.review = Review.objects.create(
            USER_ID=cls.author,
            BUSN_ID=cls.business,
            REVW_TEXT="Retained review used only as a dispute reference.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )

    def make_request(
        self,
        request_type,
        status="withdrawn",
        *,
        source_id=None,
        resolved=True,
        reviewer=True,
    ):
        """Create a retained request receipt with the fields required by its existing model."""
        model, prefix = self.REQUESTS[request_type]
        fields = {
            "BUSN_ID": self.business,
            "USER_ID": self.merchant,
            f"{prefix}_STATUS": status,
            f"{prefix}_SUBMITTED_AT": self.now - timedelta(hours=2),
            f"{prefix}_RESOLVED_AT": None,
        }
        if resolved:
            fields[f"{prefix}_RESOLVED_AT"] = self.now - timedelta(hours=1)
        if source_id is not None:
            fields[f"{prefix}_ID"] = source_id
        if (
            status in ("approved", "rejected")
            and reviewer
        ):
            fields["REVIEWER_ID"] = self.admin

        if request_type == "business_name_change":
            fields.update({
                "BNCR_PREVIOUS_BUSINESS_NAME": "Submitted baseline name",
                "BNCR_PROPOSED_BUSINESS_NAME": "Submitted proposed name",
            })
        elif request_type == "business_classification_change":
            fields.update({
                "PREVIOUS_CTGRY_ID": self.category,
                "PROPOSED_CTGRY_ID": self.category,
                "BCCR_PREVIOUS_CATEGORY_NAME": "Submitted category",
                "BCCR_PREVIOUS_CLUSTER_ID": self.cluster.pk,
                "BCCR_PREVIOUS_CLUSTER_NAME": "Submitted cluster",
                "BCCR_PROPOSED_CATEGORY_NAME": "Proposed category",
                "BCCR_PROPOSED_CLUSTER_ID": self.cluster.pk,
                "BCCR_PROPOSED_CLUSTER_NAME": "Proposed cluster",
            })
        else:
            fields.update({
                "BLCR_PREVIOUS_LOCT_ID": self.location.pk,
                "BLCR_PREVIOUS_POINT": Point(123.9, 10.3, srid=4326),
                "BLCR_PREVIOUS_ADDRESS": "Submitted baseline address",
                "BLCR_PREVIOUS_CITY": "Cebu City",
                "BLCR_PREVIOUS_PROVINCE": "Cebu",
                "BLCR_PROPOSED_POINT": Point(123.91, 10.31, srid=4326),
                "BLCR_PROPOSED_ADDRESS": "Submitted proposed address",
                "BLCR_PROPOSED_CITY": "Cebu City",
                "BLCR_PROPOSED_PROVINCE": "Cebu",
            })
        return model.objects.create(**fields)

    def make_dispute(
        self,
        status="withdrawn",
        *,
        source_id=None,
        resolved=True,
        closure_reason="",
    ):
        """Retain filing identities and a separate terminal timestamp without recording a resolver."""
        fields = {
            "USER_ID": self.merchant,
            "BUSN_ID": self.business,
            "REVW_ID": self.review,
            "MRDSP_REASON": MerchantReviewDispute.DisputeReason.OTHER,
            "MRDSP_DESCRIPTION": "Merchant filing details are not list projection fields.",
            "MRDSP_STATUS": status,
            "MRDSP_CLOSURE_REASON": closure_reason,
        }
        if source_id is not None:
            fields["MRDSP_ID"] = source_id
        if resolved:
            fields["MRDSP_RESOLVED_AT"] = self.now - timedelta(hours=1)
        dispute = MerchantReviewDispute.objects.create(**fields)
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            MRDSP_CREATED_AT=self.now - timedelta(hours=2),
        )
        return dispute

    def test_all_four_sources_normalize_submission_and_withdrawal_separately(self):
        records = {
            f"{request_type}_request": self.make_request(request_type)
            for request_type in self.REQUESTS
        }
        records["merchant_review_dispute"] = self.make_dispute()

        with CaptureQueriesContext(connection) as queries:
            rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(queries), 1)
        self.assertIn("UNION ALL", queries[0]["sql"])
        self.assertEqual(len(rows), 8)
        for source_type, record in records.items():
            with self.subTest(source=source_type):
                source_rows = [
                    row
                    for row in rows
                    if row["source_type"] == source_type
                ]
                self.assertEqual(len(source_rows), 2)
                self.assertEqual(
                    {row["source_id"] for row in source_rows},
                    {str(record.pk)},
                )
                for row in source_rows:
                    self.assertEqual(tuple(row), UnifiedActivityService.COLUMNS)
                    self.assertEqual(row["target_type"], source_type)
                    self.assertEqual(row["target_id"], str(record.pk))
                    self.assertEqual(row["actor_id"], self.merchant.pk)
                    self.assertIsNone(row["actor_display_snapshot"])
                    self.assertIsNone(row["actor_role_snapshot"])
                    self.assertIsNone(row["target_label"])
                    self.assertIsNone(row["outcome"])
                    self.assertFalse(row["is_administrative"])
                    self.assertEqual(row["provenance"]["model"], record._meta.label_lower)
                    self.assertEqual(row["provenance"]["business_id"], self.business.pk)
                    self.assertEqual(row["provenance"]["requester_id"], self.merchant.pk)
                self.assertEqual(source_rows[0]["new_state"], {"status": "withdrawn"})
                self.assertEqual(source_rows[0]["occurred_at"], self.now - timedelta(hours=1))
                self.assertTrue(source_rows[0]["occurrence"].endswith("_withdrawn"))
                self.assertIsNone(source_rows[1]["new_state"])
                self.assertEqual(source_rows[1]["occurred_at"], self.now - timedelta(hours=2))
                if source_type == "merchant_review_dispute":
                    self.assertEqual(source_rows[1]["occurrence"], "merchant_review_dispute_filed")
                    self.assertEqual(source_rows[1]["provenance"]["review_id"], self.review.pk)
                else:
                    self.assertTrue(source_rows[1]["occurrence"].endswith("_submitted"))

    def test_request_resolutions_use_recorded_reviewers_and_preserve_decision_states(self):
        expected = {}
        for request_type in self.REQUESTS:
            for status in ("approved", "rejected"):
                request = self.make_request(request_type, status)
                expected[(f"{request_type}_request", str(request.pk))] = (
                    f"{request_type}_{status}",
                    status,
                )

        rows = list(UnifiedActivityService.list_activity())
        self.assertEqual(len(rows), 12)
        resolutions = [
            row
            for row in rows
            if row["is_administrative"]
        ]
        self.assertEqual(len(resolutions), 6)
        for row in resolutions:
            with self.subTest(source=row["source_type"], source_id=row["source_id"]):
                occurrence, status = expected[(row["source_type"], row["source_id"])]
                self.assertEqual(row["occurrence"], occurrence)
                self.assertEqual(row["new_state"], {"status": status})
                self.assertEqual(row["actor_id"], self.admin.pk)
                self.assertIsNone(row["actor_role_snapshot"])
                self.assertIsNone(row["outcome"])

    def test_missing_request_reviewer_remains_null(self):
        self.make_request("business_name_change", "approved", reviewer=False)
        resolution = next(
            row
            for row in UnifiedActivityService.list_activity()
            if row["is_administrative"]
        )

        self.assertIsNone(resolution["actor_id"])
        self.assertIsNone(resolution["actor_role_snapshot"])
        self.assertEqual(resolution["new_state"], {"status": "approved"})

    def test_dispute_administrative_resolutions_never_credit_the_filing_merchant(self):
        self.make_dispute("upheld")
        self.make_dispute("dismissed")
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 4)
        decisions = [
            row
            for row in rows
            if row["is_administrative"]
        ]
        self.assertEqual(
            {row["occurrence"] for row in decisions},
            {"review_dispute_upheld", "review_dispute_dismissed"},
        )
        for row in decisions:
            self.assertIsNone(row["actor_id"])
            self.assertIsNone(row["actor_role_snapshot"])
            self.assertIn(row["new_state"]["status"], ("upheld", "dismissed"))

    def test_automatic_closures_have_no_merchant_or_invented_system_actor(self):
        for status, reason in (
            ("author_deleted", "content_removed_by_author"),
            ("review_removed", "original_review_removed"),
        ):
            self.make_dispute(status, closure_reason=reason)
        rows = list(UnifiedActivityService.list_activity())
        closures = [
            row
            for row in rows
            if row["occurrence"] == "merchant_review_dispute_closed"
        ]

        self.assertEqual(len(rows), 4)
        self.assertEqual(len(closures), 2)
        for row in closures:
            self.assertIsNone(row["actor_id"])
            self.assertIsNone(row["actor_role_snapshot"])
            self.assertFalse(row["is_administrative"])
            self.assertIn(row["new_state"]["status"], ("author_deleted", "review_removed"))
            self.assertTrue(row["new_state"]["closure_reason"])

    def test_dispute_original_identities_survive_missing_live_relations(self):
        dispute = self.make_dispute()
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            USER_ID=None,
            BUSN_ID=None,
            REVW_ID=None,
        )
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertEqual(row["actor_id"], self.merchant.pk)
            self.assertEqual(row["provenance"]["business_id"], self.business.pk)
            self.assertEqual(row["provenance"]["review_id"], self.review.pk)

    def test_terminal_status_without_a_terminal_timestamp_does_not_invent_occurrences(self):
        self.make_request("business_name_change", "approved", resolved=False)
        self.make_dispute("upheld", resolved=False)
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 2)
        self.assertEqual(
            {row["occurrence"] for row in rows},
            {"business_name_change_request_submitted", "merchant_review_dispute_filed"},
        )
        for row in rows:
            self.assertIsNone(row["new_state"])

    def test_existing_audit_decisions_are_not_duplicated_by_domain_resolution_projections(self):
        for request_type in self.REQUESTS:
            request = self.make_request(request_type, "approved")
            AdminActivity.objects.create(
                ACTOR_ID=self.admin,
                TARGET_USER_ID=self.merchant,
                AACT_ACTION=f"{request_type}_approved",
                AACT_CONTEXT={
                    "request_id": request.pk,
                    "request_type": request_type,
                    "outcome": "approved",
                },
            )
        dispute = self.make_dispute("upheld")
        AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            TARGET_USER_ID=self.author,
            AACT_ACTION=AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
            AACT_CONTEXT={"dispute_id": dispute.pk, "dispute_status": "upheld"},
        )
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 8)
        decisions = [
            row
            for row in rows
            if row["is_administrative"]
        ]
        self.assertEqual(len(decisions), 4)
        for row in decisions:
            self.assertEqual(row["source_type"], "admin_activity")
            self.assertEqual(row["actor_id"], self.admin.pk)
        self.assertEqual(
            len([row for row in rows if not row["is_administrative"]]),
            4,
        )

    def test_multi_occurrence_rows_sort_and_paginate_with_the_initial_sources(self):
        for request_type in self.REQUESTS:
            request = self.make_request(request_type, source_id=42)
            model, prefix = self.REQUESTS[request_type]
            model.objects.filter(pk=request.pk).update(**{
                f"{prefix}_SUBMITTED_AT": self.now,
                f"{prefix}_RESOLVED_AT": self.now,
            })
        dispute = self.make_dispute(source_id=42)
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            MRDSP_CREATED_AT=self.now,
            MRDSP_RESOLVED_AT=self.now,
        )
        activity = AdminActivity.objects.create(
            AACT_ID=42,
            ACTOR_ID=self.admin,
            AACT_ACTION=AdminActivity.Action.USER_SUSPENDED,
        )
        AdminActivity.objects.filter(pk=activity.pk).update(AACT_CREATED_AT=self.now)
        policy = AnalyticsPolicyChange.objects.create(
            APCH_ID=42,
            APCH_VERSION=2,
            APCH_REASON="Retained policy revision.",
            APCH_AFTER={},
        )
        AnalyticsPolicyChange.objects.filter(pk=policy.pk).update(APCH_CREATED_AT=self.now)
        application = MerchantApplication.objects.create(USER_ID=self.merchant)
        MerchantApplicationSubmission.objects.create(
            MASUB_ID=42,
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=self.now,
        )
        expected = [
            ("admin_activity", "user_suspended"),
            ("analytics_policy_change", "analytics_policy_revision"),
            ("business_classification_change_request", "business_classification_change_request_submitted"),
            ("business_classification_change_request", "business_classification_change_request_withdrawn"),
            ("business_location_change_request", "business_location_change_request_submitted"),
            ("business_location_change_request", "business_location_change_request_withdrawn"),
            ("business_name_change_request", "business_name_change_request_submitted"),
            ("business_name_change_request", "business_name_change_request_withdrawn"),
            ("merchant_application_submission", "merchant_application_submitted"),
            ("merchant_review_dispute", "merchant_review_dispute_filed"),
            ("merchant_review_dispute", "merchant_review_dispute_withdrawn"),
        ]
        paginator = Paginator(UnifiedActivityService.list_activity(), 3)
        with CaptureQueriesContext(connection) as queries:
            rows = [
                row
                for page_number in paginator.page_range
                for row in paginator.page(page_number).object_list
            ]

        self.assertEqual(len(queries), 5)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        self.assertIn("LIMIT 3", queries[1]["sql"])
        self.assertIn("LIMIT 2 OFFSET 9", queries[-1]["sql"])
        self.assertEqual(paginator.count, 11)
        self.assertEqual(
            [(row["source_type"], row["occurrence"]) for row in rows],
            expected,
        )
        self.assertEqual({row["source_id"] for row in rows}, {"42"})
