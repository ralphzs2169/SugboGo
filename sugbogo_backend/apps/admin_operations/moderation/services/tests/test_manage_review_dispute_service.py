from datetime import timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase, TransactionTestCase
from django.db import close_old_connections, transaction
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from threading import Event
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import BusinessReviewSummary, Review
from apps.users.models import ReputationEvent, User
from apps.users.services.reputation_service import ReputationService
from apps.admin_operations.activity_management.models import AdminActivity
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService


class ManageReviewDisputeServiceTests(TestCase):
    """Tests for administrator-facing review dispute moderation."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="moderation-admin@example.com", password=None,
            USER_FNAME="Admin", USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.merchant = User.objects.create_user(
            email="moderation-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_merchant = User.objects.create_user(
            email="moderation-merchant-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="moderation-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_explorer = User.objects.create_user(
            email="moderation-explorer-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9000,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Colon Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Moderation Business",
            BUSN_DESCRIPTION="A business for moderation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.second_business = Business.objects.create(
            BUSN_NAME="Second Moderation Business",
            BUSN_DESCRIPTION="Another business for moderation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.second_location,
        )

        self.review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="This is a moderation test review.",
        )

        self.second_review = Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.second_business,
            REVW_TEXT="Another moderation test review.",
        )

    def create_dispute(
        self,
        review=None,
        business=None,
        merchant=None,
        reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
        status=MerchantReviewDispute.DisputeStatus.PENDING,
        description="Test dispute.",
    ):
        review = review or self.review
        business = business or review.BUSN_ID
        merchant = merchant or business.USER_ID

        return MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=business,
            USER_ID=merchant,
            MRDSP_REASON=reason,
            MRDSP_DESCRIPTION=description,
            MRDSP_STATUS=status,
        )

    def test_uphold_refreshes_sentiment_and_removes_generated_evidence(self):
        self.review.REVW_SENTIMENT_LABEL = "positive"
        self.review.REVW_SENTIMENT_SCORE = 0.75
        self.review.save()
        summary = BusinessReviewSummary.objects.create(
            BUSN_ID=self.business, BRSU_POSITIVE_COUNT=1,
            BRSU_REVIEW_COUNT=1, BRSU_CLASSIFIED_REVIEW_COUNT=1,
            BRSU_NARRATIVE="Visitors mention friendly staff.",
            BRSU_SUPPORTING_REVIEW_REFERENCES={"narrative_review_ids": [self.review.pk]},
            BRSU_GENERATION_STATE=BusinessReviewSummary.GenerationState.READY,
        )
        dispute = self.create_dispute()
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                ManageReviewDisputeService.uphold_dispute(
                    dispute.pk,
                    actor=self.admin,
                )
                enqueue.assert_not_called()
            enqueue.assert_called_once_with(self.business.pk)
        summary.refresh_from_db()
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 0)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)
        self.assertEqual(summary.BRSU_NARRATIVE, "")
        event = AdminActivity.objects.get()
        self.assertEqual(event.ACTOR_ID_id, self.admin.pk)
        self.assertEqual(event.AACT_CONTEXT["previous_review_status"], "published")
        self.assertEqual(event.AACT_CONTEXT["review_status"], "rejected")

    def test_dismiss_audits_actor_without_changing_review_or_refreshing_insights(self):
        dispute = self.create_dispute()
        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                ManageReviewDisputeService.dismiss_dispute(
                    dispute.pk,
                    "No violation found.",
                    actor=self.admin,
                )
            enqueue.assert_not_called()
        event = AdminActivity.objects.get()
        self.assertEqual(event.ACTOR_ID_id, self.admin.pk)
        self.assertEqual(event.TARGET_USER_ID_id, self.explorer.pk)
        self.assertEqual(event.AACT_CONTEXT["dispute_status"], "dismissed")
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "published")

    def test_audit_failure_rolls_back_resolution_and_discards_refresh(self):
        dispute = self.create_dispute()
        with (
            patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue,
            patch.object(ManageReviewDisputeService, "_record_resolution", side_effect=RuntimeError("Audit failed")),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError):
                    ManageReviewDisputeService.uphold_dispute(
                        dispute.pk,
                        actor=self.admin,
                    )
            enqueue.assert_not_called()
        dispute.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, "pending")
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(ReputationEvent.objects.exists())

    # list_disputes

    def test_list_disputes_returns_all_disputes(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(),
        )

        self.assertEqual(
            {dispute.MRDSP_ID for dispute in disputes},
            {
                first_dispute.MRDSP_ID,
                second_dispute.MRDSP_ID,
            },
        )

    def test_list_disputes_filters_by_status(self):
        pending_dispute = self.create_dispute()

        dismissed_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            status=MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                status=MerchantReviewDispute.DisputeStatus.PENDING,
            ),
        )

        returned_ids = [
            dispute.MRDSP_ID
            for dispute in disputes
        ]

        self.assertEqual(
            returned_ids,
            [pending_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            dismissed_dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_disputes_filters_by_reason(self):
        fake_review_dispute = self.create_dispute()

        abusive_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [abusive_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            fake_review_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_filters_by_business(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                business_id=self.business.BUSN_ID,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [first_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_filters_by_review(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                review_id=self.review.REVW_ID,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [first_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_orders_by_created_at_descending_by_default(self):
        older_dispute = self.create_dispute()

        older_dispute.MRDSP_CREATED_AT = (
            timezone.now() - timedelta(days=2)
        )
        older_dispute.save(
            update_fields=["MRDSP_CREATED_AT"],
        )

        newer_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [
                newer_dispute.MRDSP_ID,
                older_dispute.MRDSP_ID,
            ],
        )

    def test_list_disputes_supports_created_at_ascending_order(self):
        older_dispute = self.create_dispute()

        older_dispute.MRDSP_CREATED_AT = (
            timezone.now() - timedelta(days=2)
        )
        older_dispute.save(
            update_fields=["MRDSP_CREATED_AT"],
        )

        newer_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                ordering="created_at",
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [
                older_dispute.MRDSP_ID,
                newer_dispute.MRDSP_ID,
            ],
        )


    # get_dispute

    def test_get_dispute_returns_requested_dispute(self):
        dispute = self.create_dispute()

        result = ManageReviewDisputeService.get_dispute(
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            result.MRDSP_ID,
            dispute.MRDSP_ID,
        )

    def test_get_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.get_dispute(999999)


    # uphold_dispute

    def test_uphold_dispute_rejects_review(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
            "Violates policy.",
            actor=self.admin,
        )

        dispute.refresh_from_db()
        self.review.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "Violates policy.",
        )

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.REJECTED,
        )

    def test_uphold_dispute_allows_empty_admin_notes(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
            actor=self.admin,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertIsNone(
            dispute.MRDSP_ADMIN_NOTES,
        )

    def test_uphold_dispute_sets_resolution_timestamp(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        before = timezone.now()

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
            actor=self.admin,
        )

        after = timezone.now()

        dispute.refresh_from_db()

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertGreaterEqual(
            dispute.MRDSP_RESOLVED_AT,
            before,
        )

        self.assertLessEqual(
            dispute.MRDSP_RESOLVED_AT,
            after,
        )


    def test_uphold_dispute_rejects_already_resolved_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only pending review disputes can be upheld."
        ):
            ManageReviewDisputeService.uphold_dispute(
                dispute.MRDSP_ID,
                actor=self.admin,
            )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_uphold_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.uphold_dispute(
                999999,
                actor=self.admin,
            )

    def test_uphold_dispute_creates_confirmed_violation_event_for_review_author(self):
        dispute = self.create_dispute()
        author_reputation_before = self.explorer.USER_REPUTATION
        merchant_reputation_before = self.merchant.USER_REPUTATION

        ManageReviewDisputeService.uphold_dispute(
            dispute.pk,
            actor=self.admin,
        )

        event = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
            REVT_SOURCE_ID=self.review.pk,
        )
        self.assertEqual(event.USER_ID_id, self.explorer.pk)
        self.assertEqual(
            event.REVT_SOURCE_TYPE,
            ReputationEvent.SourceType.CONFIRMED_REVIEW_VIOLATION,
        )
        self.assertEqual(event.REVT_SOURCE_KEY, f"review:{self.review.pk}")
        self.assertLess(event.REVT_APPLIED_CHANGE, 0)
        self.explorer.refresh_from_db()
        self.merchant.refresh_from_db()
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            author_reputation_before + event.REVT_APPLIED_CHANGE,
        )
        self.assertEqual(event.REVT_RESULTING_REPUTATION, self.explorer.USER_REPUTATION)
        self.assertEqual(self.merchant.USER_REPUTATION, merchant_reputation_before)

    def test_second_uphold_raises_before_penalty_call_and_does_not_double_penalize(self):
        dispute = self.create_dispute()
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk,
            actor=self.admin,
        )
        self.explorer.refresh_from_db()
        reputation_after_first_uphold = self.explorer.USER_REPUTATION

        with patch(
            "apps.admin_operations.moderation.services.manage_review_dispute_service."
            "ReputationService.apply_confirmed_violation_penalty",
            wraps=ReputationService.apply_confirmed_violation_penalty,
        ) as penalty:
            with self.assertRaisesMessage(
                ValidationError,
                "Only pending review disputes can be upheld.",
            ):
                ManageReviewDisputeService.uphold_dispute(
                    dispute.pk,
                    actor=self.admin,
                )
            penalty.assert_not_called()

        self.explorer.refresh_from_db()
        self.assertEqual(self.explorer.USER_REPUTATION, reputation_after_first_uphold)
        self.assertEqual(
            ReputationEvent.objects.filter(
                USER_ID=self.explorer,
                REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
                REVT_SOURCE_ID=self.review.pk,
            ).count(),
            1,
        )

    def test_penalty_failure_rolls_back_dispute_review_event_and_reputation(self):
        dispute = self.create_dispute()
        reputation_before = self.explorer.USER_REPUTATION
        apply_penalty = ReputationService.apply_confirmed_violation_penalty

        def apply_penalty_then_fail(**kwargs):
            self.review.refresh_from_db()
            self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
            apply_penalty(**kwargs)
            raise RuntimeError("Failure after penalty")

        with patch(
            "apps.admin_operations.moderation.services.manage_review_dispute_service."
            "ReputationService.apply_confirmed_violation_penalty",
            side_effect=apply_penalty_then_fail,
        ), self.assertRaisesRegex(RuntimeError, "Failure after penalty"):
            ManageReviewDisputeService.uphold_dispute(
                dispute.pk,
                "Violates policy.",
                actor=self.admin,
            )

        dispute.refresh_from_db()
        self.review.refresh_from_db()
        self.explorer.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, MerchantReviewDispute.DisputeStatus.PENDING)
        self.assertIsNone(dispute.MRDSP_RESOLVED_AT)
        self.assertIsNone(dispute.MRDSP_ADMIN_NOTES)
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(self.explorer.USER_REPUTATION, reputation_before)
        self.assertFalse(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY,
                REVT_SOURCE_ID=self.review.pk,
            ).exists(),
        )

    # dismiss_dispute

    def test_dismiss_dispute_changes_status(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        result = ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
            actor=self.admin,
        )

        self.assertEqual(
            result.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

    def test_dismiss_dispute_stores_admin_notes(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
            "Insufficient evidence.",
            actor=self.admin,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "Insufficient evidence.",
        )

    def test_dismiss_dispute_sets_resolution_timestamp(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        before = timezone.now()

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
            actor=self.admin,
        )

        after = timezone.now()

        dispute.refresh_from_db()

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertGreaterEqual(
            dispute.MRDSP_RESOLVED_AT,
            before,
        )

        self.assertLessEqual(
            dispute.MRDSP_RESOLVED_AT,
            after,
        )

    def test_dismiss_dispute_does_not_modify_review_status(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
            actor=self.admin,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )


    def test_dismiss_dispute_rejects_already_upheld_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only pending review disputes can be dismissed.",
        ):
            ManageReviewDisputeService.dismiss_dispute(
                dispute.MRDSP_ID,
                actor=self.admin,
            )

    def test_dismiss_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.dismiss_dispute(
                999999,
                actor=self.admin,
            )


class ConcurrentDisputeResolutionTests(TransactionTestCase):
    """Exercises competing decisions using separate PostgreSQL connections."""

    setUp = ManageReviewDisputeServiceTests.setUp
    create_dispute = ManageReviewDisputeServiceTests.create_dispute

    def test_dismiss_waits_for_uphold_and_rejects_resolved_dispute(self):
        self._assert_competing_decision_is_rejected(withdraw=False)

    def test_withdraw_waits_for_uphold_and_rejects_resolved_dispute(self):
        self._assert_competing_decision_is_rejected(withdraw=True)

    def _assert_competing_decision_is_rejected(self, withdraw):
        dispute = self.create_dispute()
        started = Event()

        def dismiss():
            close_old_connections()
            try:
                started.set()
                try:
                    if withdraw:
                        ReviewDisputeService.withdraw_dispute(self.merchant, dispute.pk)
                    else:
                        ManageReviewDisputeService.dismiss_dispute(
                            dispute.pk,
                            actor=self.admin,
                        )
                except ValidationError:
                    return "rejected"
                return "dismissed"
            finally:
                close_old_connections()

        with patch("apps.reviews.tasks.refresh_business_review_insights.delay") as enqueue:
            with ThreadPoolExecutor(max_workers=1) as executor:
                with transaction.atomic():
                    ManageReviewDisputeService.uphold_dispute(
                        dispute.pk,
                        actor=self.admin,
                    )
                    future = executor.submit(dismiss)
                    self.assertTrue(started.wait(5))
                    with self.assertRaises(TimeoutError):
                        future.result(timeout=0.2)
                self.assertEqual(future.result(timeout=10), "rejected")
            enqueue.assert_called_once_with(self.business.pk)
        dispute.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, "upheld")
        self.assertEqual(AdminActivity.objects.count(), 1)
