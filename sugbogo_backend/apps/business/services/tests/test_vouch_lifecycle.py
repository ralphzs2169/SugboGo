from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db import transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch
from apps.business.services.specialty_score_service import SpecialtyScoreService
from apps.business.services.tests import test_vouch_service as fixtures
from apps.business.services.vouch_service import VouchService
from apps.notifications.models import Notification
from apps.users.models import ReputationEvent, User


class VouchLifecycleFixtures:
    """Provide real endorsement transitions with isolated broker and realtime effects."""

    @classmethod
    def setUpTestData(cls):
        fixtures.BusinessVouchServiceTests.setUpTestData.__func__(cls)

    def setUp(self):
        super().setUp()
        dispatch = patch(
            "apps.business.tasks.recompute_business_discovery_score.delay",
        )
        self.dispatch = dispatch.start()
        self.addCleanup(dispatch.stop)
        realtime = patch(
            "apps.notifications.services.notification_realtime_service."
            "NotificationRealtimeService.publish",
        )
        realtime.start()
        self.addCleanup(realtime.stop)

    def _create(self):
        return VouchService.create_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
            installation_id="original-installation",
        )

    def _withdraw(self):
        VouchService.remove_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )

    def _assert_counts(
        self,
        expected,
    ):
        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, expected)
        self.assertEqual(self.spicy_business_tag.BST_VOUCH_COUNT, expected)

    @staticmethod
    def _identity(vouch):
        return (
            vouch.pk,
            vouch.VOUCH_CREATED_AT,
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            vouch.VOUCH_EVIDENCE_IS_VALID,
            vouch.VOUCH_EVIDENCE_INVALIDATED_AT,
            vouch.VOUCH_FLAG_SUSPICIOUS,
            vouch.VOUCH_INSTALLATION_ID,
        )


class PersistentVouchTests(VouchLifecycleFixtures, TestCase):
    """Protect immutable endorsement evidence across user support transitions."""

    def test_reinstatement_preserves_identity_despite_new_reputation_and_context(self):
        vouch = self._create()
        original = self._identity(vouch)
        self._withdraw()
        vouch.refresh_from_db()
        self.assertIsNotNone(vouch.VOUCH_WITHDRAWN_AT)
        self.assertEqual(self._identity(vouch), original)
        self._assert_counts(0)

        User.objects.filter(pk=self.user.pk).update(
            USER_REPUTATION=Decimal("0.80"),
        )
        restored = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
            installation_id="replacement-installation",
        )

        self.assertEqual(self._identity(restored), original)
        self.assertIsNone(restored.VOUCH_WITHDRAWN_AT)
        self.assertEqual(BusinessVouch.objects.count(), 1)
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 1)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_REPUTATION, Decimal("0.80"))
        self._assert_counts(1)

    def test_delayed_reinstatement_preserves_age_and_excludes_withdrawn_scores(self):
        vouch = self._create()
        reference_time = timezone.now()
        original_time = reference_time - timedelta(days=360)
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_CREATED_AT=original_time,
        )
        before = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
            reference_time=reference_time,
        )
        self._withdraw()
        absent = SpecialtyScoreService.recompute_business_specialty_score(
            business_id=self.business.pk,
            reference_time=reference_time,
        )
        self.assertEqual(absent.specialty_score, Decimal("0.00000"))
        self.assertEqual(
            SpecialtyScoreService.recompute_tag_score(
                business_specialty_id=self.spicy_business_tag.pk,
                reference_time=reference_time,
            ).valid_evidence_count,
            0,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_WITHDRAWN_AT=reference_time - timedelta(days=180),
        )
        restored = self._create()
        after = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
            reference_time=reference_time,
        )

        self.assertEqual(restored.VOUCH_CREATED_AT, original_time)
        self.assertEqual(after.raw_tag_evidence, before.raw_tag_evidence)
        self.assertEqual(after.tag_score, before.tag_score)
        self.assertLess(after.raw_tag_evidence, Decimal("0.20"))

        at_creation = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
            reference_time=original_time,
        )
        before_creation = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
            reference_time=original_time - timedelta(microseconds=1),
        )
        self.assertEqual(at_creation.valid_evidence_count, 1)
        self.assertEqual(
            at_creation.raw_tag_evidence,
            restored.VOUCH_REPUTATION_SNAPSHOT,
        )
        self.assertEqual(before_creation.valid_evidence_count, 0)
        self.assertEqual(before_creation.tag_score, Decimal("0.00000"))

    def test_lower_current_reputation_does_not_replace_original_snapshot(self):
        original = self._create()
        self._withdraw()
        User.objects.filter(pk=self.user.pk).update(
            USER_REPUTATION=Decimal("0.05"),
        )
        restored = self._create()

        self.assertEqual(
            restored.VOUCH_REPUTATION_SNAPSHOT,
            original.VOUCH_REPUTATION_SNAPSHOT,
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_REPUTATION, Decimal("0.05"))

    def test_invalid_evidence_can_be_withdrawn_but_cannot_be_reinstated(self):
        vouch = self._create()
        invalidated_at = timezone.now()
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_EVIDENCE_INVALIDATED_AT=invalidated_at,
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        self._assert_counts(1)
        self._withdraw()
        vouch.refresh_from_db()
        original = self._identity(vouch)

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with self.assertRaisesMessage(ValidationError, "evidence is invalid"):
                self._create()

        self.assertEqual(callbacks, [])
        vouch.refresh_from_db()
        self.assertIsNotNone(vouch.VOUCH_WITHDRAWN_AT)
        self.assertEqual(self._identity(vouch), original)
        self._assert_counts(0)

    def test_suspicious_valid_evidence_keeps_its_flag_and_score_eligibility(self):
        vouch = self._create()
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        self._withdraw()
        restored = self._create()
        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
        )

        self.assertTrue(restored.VOUCH_FLAG_SUSPICIOUS)
        self.assertTrue(restored.VOUCH_EVIDENCE_IS_VALID)
        self.assertEqual(result.valid_evidence_count, 1)

    def test_only_committed_transitions_dispatch_once_and_repeated_requests_do_not(self):
        with self.captureOnCommitCallbacks(execute=True):
            self._create()
            self.dispatch.assert_not_called()
        self.assertEqual(self.dispatch.call_count, 1)

        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(ValidationError):
                self._create()
        self.assertEqual(self.dispatch.call_count, 1)

        with self.captureOnCommitCallbacks(execute=True):
            self._withdraw()
        self.assertEqual(self.dispatch.call_count, 2)

        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(NotFound):
                self._withdraw()
        self.assertEqual(self.dispatch.call_count, 2)

        with self.captureOnCommitCallbacks(execute=True):
            self._create()
        self.assertEqual(self.dispatch.call_count, 3)
        self.dispatch.assert_called_with(business_id=self.business.pk)
        self._assert_counts(1)

    def test_counter_failure_rolls_back_withdrawal_and_reinstatement(self):
        vouch = self._create()

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with patch.object(
                VouchService,
                "_update_counts",
                side_effect=RuntimeError("counter write failed"),
            ), self.assertRaises(RuntimeError):
                self._withdraw()
        self.assertEqual(callbacks, [])
        vouch.refresh_from_db()
        self.assertIsNone(vouch.VOUCH_WITHDRAWN_AT)
        self._assert_counts(1)

        self._withdraw()
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with patch.object(
                VouchService,
                "_update_counts",
                side_effect=RuntimeError("counter write failed"),
            ), self.assertRaises(RuntimeError):
                self._create()
        self.assertEqual(callbacks, [])
        vouch.refresh_from_db()
        self.assertIsNotNone(vouch.VOUCH_WITHDRAWN_AT)
        self._assert_counts(0)

    def test_outer_rollback_discards_identity_rewards_and_dispatch(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    self._create()
                    raise RuntimeError("abort outer transaction")

        self.assertEqual(callbacks, [])
        self.dispatch.assert_not_called()
        self.assertFalse(BusinessVouch.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self._assert_counts(0)

    def test_dispatch_failure_keeps_the_committed_transition_successful(self):
        self.dispatch.side_effect = RuntimeError("broker unavailable")
        with patch(
            "apps.business.services.discovery_score_refresh_service.logger.exception",
        ) as logger, self.captureOnCommitCallbacks(execute=True):
            self._create()

        logger.assert_called_once()
        self._assert_counts(1)

    def test_inactive_assignment_cannot_restore_and_reactivation_keeps_identity(self):
        vouch = self._create()
        BusinessSpecialtyTag.objects.filter(pk=self.spicy_business_tag.pk).update(
            BST_IS_ACTIVE=False,
        )
        self._withdraw()
        with self.assertRaisesMessage(ValidationError, "not associated"):
            self._create()
        self._assert_counts(0)
        BusinessSpecialtyTag.objects.filter(pk=self.spicy_business_tag.pk).update(
            BST_IS_ACTIVE=True,
        )
        self.assertEqual(self._create().pk, vouch.pk)
        self._assert_counts(1)

    def test_reinstatement_rechecks_business_status_and_ownership(self):
        self._create()
        self._withdraw()
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        with self.assertRaisesMessage(ValidationError, "inactive business"):
            self._create()
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.user,
        )
        with self.assertRaisesMessage(ValidationError, "own business"):
            self._create()
        self._assert_counts(0)
