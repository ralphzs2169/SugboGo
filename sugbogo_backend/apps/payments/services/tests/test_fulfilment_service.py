from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.payments.services.fulfilment_service import (
    due_fulfilment_payment_ids,
    fulfil_paid_merchant_plus_payment,
)
from apps.payments.services.payment_service import PaymentService
from apps.payments.tasks import recover_merchant_plus_fulfilment


class FulfilmentFixtures(MerchantAnalyticsFixtures):
    def setUp(self):
        super().setUp()
        self.enterContext(self.settings(
            PAYMENT_PROVIDER="maya",
            PAYMENT_MODE="test",
            MERCHANT_PLUS_ENFORCED=True,
            MERCHANT_PLUS_MOCK_ENABLED=False,
        ))
        self.payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        self.paid_at = timezone.now() - timedelta(minutes=7)
        Payment.objects.filter(pk=self.payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_FULFILMENT_STATUS="pending",
            PYMT_PROVIDER_PAYMENT_ID=str(uuid4()),
            PYMT_PAID_AT=self.paid_at,
            PYMT_VERIFIED_AT=self.paid_at,
        )


class FulfilmentTests(FulfilmentFixtures, TestCase):
    def test_first_fulfilment_activates_exact_period_and_idempotent_status(self):
        client = APIClient()
        client.force_authenticate(self.merchant_a)
        url = reverse("merchant-plus-status")
        self.assertFalse(client.get(url).data["data"]["has_plus_access"])
        now = timezone.now()
        with patch("apps.payments.services.fulfilment_service.timezone.now", return_value=now):
            with self.captureOnCommitCallbacks(execute=True):
                grant = fulfil_paid_merchant_plus_payment(self.payment.pk)
        for _ in range(2):
            again = fulfil_paid_merchant_plus_payment(self.payment.pk)
            self.assertEqual(again.pk, grant.pk)
            self.assertEqual(again.MPPE_EXPIRES_AT, now + timedelta(days=30))
        self.assertEqual(grant.MPPE_STARTS_AT, now)
        self.assertEqual(PaidMerchantPlusEntitlement.objects.count(), 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "fulfilled")
        self.assertEqual(self.payment.PYMT_PAID_AT, self.paid_at)
        status = client.get(url).data["data"]
        self.assertTrue(status["has_plus_access"])
        self.assertEqual(status["access_source"], "maya_test")
        self.assertEqual(Notification.objects.filter(NOTF_TYPE="merchant_plus_activated").count(), 1)
        with self.settings(PAYMENT_MODE="live"):
            self.assertFalse(client.get(url).data["data"]["has_plus_access"])

    def test_invalid_product_snapshot_ownership_or_state_cannot_fulfil(self):
        invalid = (
            {"PYMT_PRODUCT": "other"},
            {"PYMT_PRODUCT_VERSION": "other"},
            {"PYMT_AMOUNT_CENTAVOS": 101},
            {"PYMT_ACCESS_DURATION_DAYS": 31},
            {"USER_ID": self.merchant_b},
            {"PYMT_FULFILMENT_STATUS": "needs_attention"},
        )
        for values in invalid:
            with self.subTest(values=values):
                with self.atomic_rollback():
                    Payment.objects.filter(pk=self.payment.pk).update(**values)
                    self.assertIsNone(fulfil_paid_merchant_plus_payment(self.payment.pk))
                    self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    @contextmanager
    def atomic_rollback(self):
        with transaction.atomic():
            yield
            transaction.set_rollback(True)

    def test_pending_and_missing_verification_never_fulfil(self):
        Payment.objects.filter(pk=self.payment.pk).update(
            PYMT_STATUS="pending",
            PYMT_FULFILMENT_STATUS="not_started",
            PYMT_PROVIDER_PAYMENT_ID=None,
            PYMT_PAID_AT=None,
            PYMT_VERIFIED_AT=None,
        )
        self.assertIsNone(fulfil_paid_merchant_plus_payment(self.payment.pk))
        self.assertEqual(due_fulfilment_payment_ids(), [])
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    def test_paid_payment_cannot_lose_required_verification_evidence(self):
        for field in (
            "PYMT_PROVIDER_PAYMENT_ID",
            "PYMT_PAID_AT",
            "PYMT_VERIFIED_AT",
        ):
            with self.subTest(field=field):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        Payment.objects.filter(pk=self.payment.pk).update(**{field: None})

    def test_partial_grant_is_reused_without_extending_expired_access(self):
        start = timezone.now() - timedelta(days=40)
        grant = PaidMerchantPlusEntitlement.objects.create(
            PYMT_ID=self.payment,
            BUSN_ID=self.business_a,
            MPPE_STARTS_AT=start,
            MPPE_EXPIRES_AT=start + timedelta(days=30),
        )
        with self.captureOnCommitCallbacks(execute=True):
            restored = fulfil_paid_merchant_plus_payment(self.payment.pk)
        self.assertEqual(restored.pk, grant.pk)
        self.assertEqual(restored.MPPE_EXPIRES_AT, grant.MPPE_EXPIRES_AT)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "fulfilled")
        self.assertFalse(Notification.objects.exists())

    def test_crash_between_creation_and_completion_rolls_back_and_recovers(self):
        with patch.object(Payment, "save", side_effect=RuntimeError("worker interrupted")):
            with self.assertRaises(RuntimeError):
                fulfil_paid_merchant_plus_payment(self.payment.pk)
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
        self.assertEqual(due_fulfilment_payment_ids(), [self.payment.pk])
        self.assertIsNotNone(fulfil_paid_merchant_plus_payment(self.payment.pk))

    def test_recovery_redispatches_due_and_ignores_other_states(self):
        with patch("apps.payments.tasks.dispatch_merchant_plus_fulfilment", return_value=True) as dispatch:
            recover_merchant_plus_fulfilment()
        dispatch.assert_called_once_with(self.payment.pk)
        for values in (
            {"PYMT_LEASE_UNTIL": timezone.now() + timedelta(minutes=1)},
            {"PYMT_RETRY_AT": timezone.now() + timedelta(minutes=1)},
            {"PYMT_PRODUCT": "other"},
            {"PYMT_FULFILMENT_STATUS": "needs_attention"},
        ):
            with self.atomic_rollback():
                Payment.objects.filter(pk=self.payment.pk).update(**values)
                self.assertEqual(due_fulfilment_payment_ids(), [])
        fulfil_paid_merchant_plus_payment(self.payment.pk)
        self.assertEqual(due_fulfilment_payment_ids(), [])

    def test_notification_failure_cannot_undo_activation(self):
        with patch("apps.payments.services.fulfilment_service.NotificationService.create", side_effect=OSError):
            with self.captureOnCommitCallbacks(execute=True):
                fulfil_paid_merchant_plus_payment(self.payment.pk)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "fulfilled")

    def test_overlapping_access_requires_review_without_stacking(self):
        now = timezone.now()
        Payment.objects.filter(pk=self.payment.pk).update(
            PYMT_FULFILMENT_STATUS="fulfilled",
            PYMT_FULFILLED_AT=now,
        )
        PaidMerchantPlusEntitlement.objects.create(
            PYMT_ID=self.payment,
            BUSN_ID=self.business_a,
            MPPE_STARTS_AT=now,
            MPPE_EXPIRES_AT=now + timedelta(days=20),
        )
        self.payment.refresh_from_db()
        self.payment.pk = None
        self.payment._state.adding = True
        self.payment.PYMT_REFERENCE = uuid4()
        self.payment.PYMT_PROVIDER_PAYMENT_ID = str(uuid4())
        self.payment.PYMT_FULFILMENT_STATUS = "pending"
        self.payment.PYMT_FULFILLED_AT = None
        self.payment.save(force_insert=True)
        self.assertIsNone(fulfil_paid_merchant_plus_payment(self.payment.pk))
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_LAST_ERROR, "active_entitlement_overlap")
        self.assertEqual(PaidMerchantPlusEntitlement.objects.count(), 1)


class FulfilmentConcurrencyTests(FulfilmentFixtures, TransactionTestCase):
    def setUp(self):
        self.setUpTestData()
        super().setUp()

    def test_postgresql_concurrent_workers_create_one_period(self):
        self.assertEqual(connection.vendor, "postgresql")
        barrier = Barrier(2)

        def worker():
            try:
                barrier.wait(timeout=10)
                return fulfil_paid_merchant_plus_payment(self.payment.pk).pk
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(worker)
                for _ in range(2)
            ]
            results = [
                future.result(timeout=20)
                for future in futures
            ]
        self.assertEqual(results[0], results[1])
        self.assertEqual(PaidMerchantPlusEntitlement.objects.count(), 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "fulfilled")
