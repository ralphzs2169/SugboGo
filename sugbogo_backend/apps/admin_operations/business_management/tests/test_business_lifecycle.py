"""Business lifecycle authorization, durable side effects, and PostgreSQL serialization."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest import skipUnless
from unittest.mock import AsyncMock, patch

from django.db import connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.test import APITestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.business_management.services.business_lifecycle_service import (
    BusinessLifecycleService,
    BusinessStatusConflict,
)
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessVouch,
    DiscoveryScore,
    PocketCollection,
    PocketMembership,
    SpecialtyTag,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import DiscoveryFeedService
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.merchant_operations.business_profile.models import (
    BusinessNameChangeRequest,
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
)
from apps.notifications.models import Notification
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.models import ReviewLike, ReviewReply
from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User


class LifecycleFixtures(DashboardFixtures):
    def setUp(self):
        super().setUp()
        self.business = self.create_business()
        self.admin = self.create_user(role=User.UserRole.ADMIN)
        realtime = patch(
            "apps.notifications.services.notification_realtime_service.NotificationRealtimeService._send",
            new_callable=AsyncMock,
        )
        realtime.start()
        self.addCleanup(realtime.stop)

    def transition(
        self,
        suspend=True,
        token=0,
        **kwargs,
    ):
        return BusinessLifecycleService.transition(
            actor=self.admin,
            business_id=self.business.pk,
            expected_transition_id=token,
            suspend=suspend,
            reason="  Listing under administrative review.  ",
            **kwargs,
        )


class BusinessLifecycleServiceTests(LifecycleFixtures, TestCase):
    def test_complete_cycle_preserves_reason_history_and_notifies_once_per_transition(self):
        first = self.transition()
        self.assertEqual(first["status"], "suspended")
        self.assertEqual(first["suspension_reason"], "Listing under administrative review.")
        restored = self.transition(False, first["transition_id"])
        self.assertEqual(restored["status"], "active")
        self.assertIsNone(restored["suspension_reason"])
        history = list(BusinessLifecycleService.history(self.business.pk))
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1].AACT_CONTEXT["reason"], first["suspension_reason"])
        self.assertEqual(history[1].ACTOR_ID_id, self.admin.pk)
        self.assertEqual(history[1].TARGET_USER_ID_id, self.business.USER_ID_id)
        self.assertEqual(history[1].AACT_CONTEXT["previous_status"], "active")
        notices = list(Notification.objects.order_by("NOTF_ID"))
        self.assertEqual(len(notices), 2)
        self.assertIn(self.business.BUSN_NAME, notices[0].NOTF_BODY)
        self.assertIn(first["suspension_reason"], notices[0].NOTF_BODY)
        self.assertEqual(notices[0].USER_ID_id, self.business.USER_ID_id)
        self.assertEqual(notices[0].NOTF_TARGET_TYPE, "")
        self.assertIsNone(notices[0].NOTF_TARGET_ID)
        self.assertEqual(notices[1].NOTF_TYPE, "business_reactivated")
        score = DiscoveryScore.objects.get(BUSN_ID=self.business)
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)
        self.assertGreater(score.DSC_REFRESH_VERSION, 0)

    def test_stale_cycle_and_repeated_requests_create_no_side_effects(self):
        with self.assertRaises(ValidationError):
            self.transition(False)
        first = self.transition()
        with self.assertRaises(ValidationError):
            self.transition(token=first["transition_id"])
        with self.assertRaises(BusinessStatusConflict):
            self.transition(token=0)
        second = self.transition(False, first["transition_id"])
        with self.assertRaises(ValidationError):
            self.transition(False, second["transition_id"])
        with self.assertRaises(BusinessStatusConflict):
            self.transition(token=0)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(BusinessLifecycleService.history(self.business.pk).count(), 2)
        self.assertGreater(second["transition_id"], first["transition_id"])

    def test_service_revalidates_persisted_administrator_role_and_status(self):
        for fields in (
            {"USER_ROLE": User.UserRole.MERCHANT},
            {"USER_ROLE": User.UserRole.EXPLORER},
            {"USER_ROLE": User.UserRole.ADMIN, "USER_STATUS": User.UserStatus.SUSPENDED},
        ):
            User.objects.filter(pk=self.admin.pk).update(**fields)
            with self.assertRaises(PermissionDenied):
                self.transition()
        self.assertFalse(Notification.objects.exists())

    def test_reason_and_token_validation_at_service_boundary(self):
        for reason in (None, "", "   ", "x" * 1001):
            with self.subTest(reason=reason):
                with self.assertRaises(ValidationError):
                    BusinessLifecycleService.transition(
                        actor=self.admin,
                        business_id=self.business.pk,
                        expected_transition_id=0,
                        suspend=True,
                        reason=reason,
                    )
        for token in (-1, True, None, "0", 0.5):
            with self.subTest(token=token):
                with self.assertRaises(ValidationError):
                    self.transition(token=token)
        with self.assertRaises(NotFound):
            BusinessLifecycleService.status(actor=self.admin, business_id=99999999)
        with self.assertRaises(NotFound):
            BusinessLifecycleService.transition(
                actor=self.admin,
                business_id=99999999,
                expected_transition_id=0,
                suspend=True,
                reason="A reason",
            )
        self.assertFalse(Notification.objects.exists())

    def test_audit_or_notification_failure_rolls_back_every_required_write(self):
        for target in (
            "apps.admin_operations.business_management.services.business_lifecycle_service.AdminActivityService.record_user_action",
            "apps.admin_operations.business_management.services.business_lifecycle_service.NotificationService.create",
        ):
            with self.subTest(target=target):
                with patch(target, side_effect=RuntimeError("Persistence unavailable")):
                    with self.assertRaises(RuntimeError):
                        self.transition()
                self.business.refresh_from_db()
                self.assertEqual(self.business.BUSN_STATUS, "active")
                self.assertFalse(BusinessLifecycleService.history(self.business.pk).exists())
                self.assertFalse(Notification.objects.exists())

    def test_suspended_owner_and_pending_requests_are_not_changed(self):
        User.objects.filter(pk=self.business.USER_ID_id).update(USER_STATUS="suspended")
        request = BusinessNameChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.business.USER_ID,
            BNCR_PREVIOUS_BUSINESS_NAME=self.business.BUSN_NAME,
            BNCR_PROPOSED_BUSINESS_NAME="Proposed name",
            BNCR_SUBMITTED_AT=self.NOW,
        )
        classification = BusinessClassificationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.business.USER_ID,
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
        location = BusinessLocationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.business.USER_ID,
            BLCR_PREVIOUS_LOCT_ID=self.location.pk,
            BLCR_PREVIOUS_POINT=self.location.LOCT_POINT,
            BLCR_PREVIOUS_ADDRESS="Old address",
            BLCR_PREVIOUS_CITY="Cebu City",
            BLCR_PREVIOUS_PROVINCE="Cebu",
            BLCR_PROPOSED_POINT=self.location.LOCT_POINT,
            BLCR_PROPOSED_ADDRESS="New address",
            BLCR_PROPOSED_CITY="Cebu City",
            BLCR_PROPOSED_PROVINCE="Cebu",
            BLCR_SUBMITTED_AT=self.NOW,
        )
        review = self.create_review(self.business)
        first = self.transition()
        restored = self.transition(False, first["transition_id"])
        self.assertEqual(restored["owner_account_status"], "suspended")
        self.business.USER_ID.refresh_from_db()
        self.assertEqual(self.business.USER_ID.USER_STATUS, "suspended")
        request.refresh_from_db()
        review.refresh_from_db()
        self.assertEqual(request.BNCR_STATUS, "pending")
        classification.refresh_from_db()
        location.refresh_from_db()
        self.assertEqual(classification.BCCR_STATUS, "pending")
        self.assertEqual(location.BLCR_STATUS, "pending")
        self.assertEqual(review.REVW_STATUS, "published")
        self.assertEqual(Business.objects.count(), 1)

    def test_historical_engagement_is_preserved_across_transitions(self):
        review = self.create_review(self.business)
        reader = self.create_user()
        like = ReviewLike.objects.create(REVW_ID=review, USER_ID=reader)
        reply = ReviewReply.objects.create(REVW_ID=review, RPLY_TEXT="Historical reply")
        tag = SpecialtyTag.objects.create(TAG_NAME="Lifecycle specialty")
        vouch = BusinessVouch.objects.create(
            USER_ID=reader,
            BUSN_ID=self.business,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=reader.USER_REPUTATION,
        )
        pocket = BusinessPocket.objects.create(USER_ID=reader, BUSN_ID=self.business)
        collection = PocketCollection.objects.create(USER_ID=reader, PCOL_NAME="Saved")
        membership = PocketMembership.objects.create(PCOL_ID=collection, PCKT_ID=pocket)
        first = self.transition()
        self.transition(False, first["transition_id"])
        for record in (review, like, reply, vouch, pocket, membership):
            self.assertTrue(type(record).objects.filter(pk=record.pk).exists())

    def test_discovery_and_task_2a_eligibility_follow_status(self):
        self.assertTrue(DiscoveryFeedService.list_eligible_businesses().filter(pk=self.business.pk).exists())
        first = self.transition()
        self.assertFalse(DiscoveryFeedService.list_eligible_businesses().filter(pk=self.business.pk).exists())
        with self.assertRaises(NotFound):
            ReviewService.create_review(self.create_user(), self.business.pk, "A review")
        with self.assertRaises(PermissionDenied):
            BusinessProfileService.update_information(self.business, {"BUSN_DESCRIPTION": "Blocked"})
        self.transition(False, first["transition_id"])
        self.assertTrue(DiscoveryFeedService.list_eligible_businesses().filter(pk=self.business.pk).exists())
        changed = BusinessProfileService.update_information(self.business, {"BUSN_DESCRIPTION": "Restored"})
        self.assertEqual(changed.BUSN_DESCRIPTION, "Restored")

    def test_reactivation_dispatch_failure_keeps_recoverable_refresh_state(self):
        first = self.transition()
        with patch("apps.business.tasks.recompute_business_discovery_score.delay", side_effect=RuntimeError("Broker down")):
            with self.captureOnCommitCallbacks(execute=True):
                self.transition(False, first["transition_id"])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_STATUS, "active")
        score = DiscoveryScore.objects.get(BUSN_ID=self.business)
        self.assertEqual(score.DSC_LAST_ERROR, "DISPATCH_FAILED")
        self.assertIsNotNone(score.DSC_REFRESH_REQUESTED_AT)

    def test_realtime_is_deferred_and_notification_failure_discards_callbacks(self):
        with patch("apps.notifications.services.notification_realtime_service.NotificationRealtimeService.publish") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.transition()
                publish.assert_not_called()
            publish.assert_called_once()

    def test_required_notification_failure_does_not_dispatch_realtime(self):
        with (
            patch("apps.admin_operations.business_management.services.business_lifecycle_service.NotificationService.create", side_effect=RuntimeError("Unavailable")),
            patch("apps.notifications.services.notification_realtime_service.NotificationRealtimeService.publish") as publish,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError):
                    self.transition()
            publish.assert_not_called()



class BusinessLifecycleAPITests(LifecycleFixtures, APITestCase):
    def url(self, action):
        return f"/api/admin/businesses/{self.business.pk}/{action}/"

    def test_admin_and_super_admin_contract_and_paginated_private_history(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.client.force_authenticate(self.create_user(role=role))
            state = self.client.get(self.url("status"))
            self.assertEqual(state.status_code, 200)
            token = state.data["data"]["transition_id"]
            response = self.client.post(self.url("suspend"), {"reason": "  Reason  ", "expected_transition_id": token})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["suspension_reason"], "Reason")
            token = response.data["data"]["transition_id"]
            history = self.client.get(self.url("status-history"))
            self.assertEqual(history.status_code, 200)
            self.assertIn("items", history.data["data"])
            self.assertEqual(history.data["data"]["items"][0]["business_id"], self.business.pk)
            restored = self.client.post(self.url("reactivate"), {"expected_transition_id": token})
            self.assertEqual(restored.status_code, 200)
            self.assertEqual(restored.data["data"]["status"], "active")
            self.assertEqual(self.client.get("/api/admin/businesses/").status_code, 200)
            self.assertEqual(self.client.get(f"/api/admin/businesses/{self.business.pk}/").status_code, 200)

    def test_unauthorized_roles_and_inactive_administrators_are_denied(self):
        paths = ("status", "status-history", "suspend", "reactivate")
        for role in (None, User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            actor = self.create_user(role=role) if role else None
            self.client.force_authenticate(actor)
            for action in paths:
                method = self.client.post if action in ("suspend", "reactivate") else self.client.get
                response = method(self.url(action))
                self.assertEqual(response.status_code, 401 if role is None else 403)
        for status in (User.UserStatus.SUSPENDED, User.UserStatus.DISABLED):
            self.client.force_authenticate(self.create_user(role=User.UserRole.ADMIN, status=status))
            self.assertEqual(self.client.post(self.url("suspend")).status_code, 403)

    def test_validation_and_stale_error_contract(self):
        self.client.force_authenticate(self.admin)
        for payload in (
            {},
            {"reason": ""},
            {"reason": " ", "expected_transition_id": 0},
            {"reason": "x" * 1001, "expected_transition_id": 0},
            {"reason": "Reason", "expected_transition_id": True},
            {"reason": "Reason", "expected_transition_id": -1},
            {"reason": "Reason", "expected_transition_id": "invalid"},
        ):
            self.assertEqual(self.client.post(self.url("suspend"), payload).status_code, 400)
        first = self.transition()
        self.transition(False, first["transition_id"])
        response = self.client.post(self.url("suspend"), {"reason": "Stale", "expected_transition_id": 0})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "BUSINESS_STATUS_CONFLICT")
        self.assertEqual(Notification.objects.count(), 2)

    def test_owner_explanation_is_private_and_scoped_to_authenticated_owner(self):
        self.transition()
        self.client.force_authenticate(self.business.USER_ID)
        response = self.client.get("/api/merchant/business-profile/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["business_id"], self.business.pk)
        self.assertEqual(response.data["data"]["suspension_reason"], "Listing under administrative review.")
        self.assertEqual(self.client.get(self.url("status-history")).status_code, 403)
        stranger = self.create_business()
        self.client.force_authenticate(stranger.USER_ID)
        response = self.client.get("/api/merchant/business-profile/status/")
        self.assertEqual(response.data["data"]["business_id"], stranger.pk)
        self.assertIsNone(response.data["data"]["suspension_reason"])


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks")
class BusinessLifecycleConcurrencyTests(DashboardFixtures, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.setUpTestData()
        dispatch = patch(
            "apps.business.services.discovery_score_refresh_service.DiscoveryScoreRefreshService._publish",
        )
        dispatch.start()
        self.addCleanup(dispatch.stop)
        self.business = self.create_business()
        self.admin = self.create_user(role=User.UserRole.ADMIN)
        realtime = patch(
            "apps.notifications.services.notification_realtime_service.NotificationRealtimeService._send",
            new_callable=AsyncMock,
        )
        realtime.start()
        self.addCleanup(realtime.stop)

    def apply(
        self,
        suspend,
        token,
        barrier=None,
    ):
        connections.close_all()
        try:
            if barrier is not None:
                barrier.wait(timeout=10)
            try:
                BusinessLifecycleService.transition(
                    actor=self.admin,
                    business_id=self.business.pk,
                    expected_transition_id=token,
                    suspend=suspend,
                    reason="Reason",
                )
                return "changed"
            except BusinessStatusConflict:
                return "stale"
            except ValidationError:
                return "invalid"
        finally:
            connections.close_all()

    def test_concurrent_requests_commit_only_one_transition(self):
        for suspend in (True, False):
            token = 0
            if not suspend:
                token = BusinessLifecycleService.history(self.business.pk).first().pk
            barrier = Barrier(2)
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(self.apply, suspend, token, barrier) for _ in range(2)]
                outcomes = [future.result(timeout=20) for future in futures]
            self.assertCountEqual(outcomes, ["changed", "stale"])
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(BusinessLifecycleService.history(self.business.pk).count(), 2)

    def test_opposite_requests_from_one_snapshot_have_one_valid_winner(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.apply, True, 0, barrier)
            b = pool.submit(self.apply, False, 0, barrier)
            results = [a.result(timeout=20), b.result(timeout=20)]
        self.assertIn("changed", results)
        self.assertTrue("stale" in results or "invalid" in results)
        self.assertEqual(Notification.objects.count(), 1)

    def test_realtime_failure_after_commit_does_not_undo_transition(self):
        with patch("apps.notifications.services.notification_realtime_service.NotificationRealtimeService._send", new_callable=AsyncMock, side_effect=RuntimeError("Redis down")):
            outcome = self.apply(True, 0)
        self.assertEqual(outcome, "changed")
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_STATUS, "suspended")
        self.assertEqual(Notification.objects.count(), 1)

    def test_review_lock_does_not_create_reverse_dependency(self):
        review = self.create_review(self.business)
        # Holding a review lock must not prevent the lifecycle from committing.
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                ReviewService._get_review(review.pk)
                future = pool.submit(self.apply, True, 0)
                self.assertEqual(future.result(timeout=15), "changed")
                with self.assertRaises(NotFound):
                    ReviewLikeService.create_like(review.USER_ID, review.pk)

    def test_owner_foreign_key_checks_can_commit_while_lifecycle_waits_on_business(self):
        attempting_business = Event()

        def transition():
            connections.close_all()
            def observe(
                execute,
                sql,
                params,
                many,
                context,
            ):
                if "FOR UPDATE" in sql and "BUSINESS" in sql:
                    attempting_business.set()
                return execute(sql, params, many, context)
            try:
                with connections["default"].execute_wrapper(observe):
                    return BusinessLifecycleService.transition(
                        actor=self.admin,
                        business_id=self.business.pk,
                        expected_transition_id=0,
                        suspend=True,
                        reason="Reason",
                    )
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                Business.objects.select_for_update().get(pk=self.business.pk)
                future = pool.submit(transition)
                self.assertTrue(attempting_business.wait(10))
                NotificationService.create(
                    recipient=self.business.USER_ID,
                    event_type="business_review_received",
                    title="Existing review publication",
                    body="Historical engagement notification.",
                    dedup_key="lifecycle-fk-order-regression",
                )
            self.assertEqual(future.result(timeout=15)["status"], "suspended")
        self.assertEqual(Notification.objects.count(), 2)
