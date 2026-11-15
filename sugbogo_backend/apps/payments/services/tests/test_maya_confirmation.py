from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from threading import Event
from unittest.mock import patch
from uuid import uuid4

from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures
from apps.payments.models import Payment, PaymentCheckoutSession, PaymentProviderEvent
from apps.payments.services.maya_webhook_service import (
    accept_maya_delivery,
    due_maya_event_ids,
    process_maya_delivery,
)
from apps.payments.services.payment_service import PaymentService
from apps.payments.tasks import dispatch_maya_event, recover_maya_events
from apps.shared.services.maya_checkout_service import MayaPaymentUnavailable
from apps.shared.services.maya_payment_evidence import MayaPaymentEvidence


RETRIEVE = "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment"


class ConfirmationFixtures(MerchantAnalyticsFixtures):
    def setUp(self):
        super().setUp()
        self.enterContext(self.settings(
            PAYMENT_PROVIDER="maya",
            PAYMENT_MODE="test",
            MAYA_WEBHOOK_ENABLED=True,
        ))
        self.user = self.merchant_a
        self.payment, _ = PaymentService.create_or_get_payment(self.user)
        self.provider_id = str(uuid4())
        self.checkout = PaymentCheckoutSession.objects.create(
            PYMT_ID=self.payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_PROVIDER_SESSION_ID=self.provider_id,
            PCHK_STATE="ready",
        )
        self.evidence = MayaPaymentEvidence(
            payment_id=self.provider_id,
            status="PAYMENT_SUCCESS",
            request_reference=str(self.checkout.PCHK_OPERATION_REFERENCE),
            amount_centavos=100,
            currency="PHP",
            paid_at=timezone.now(),
            method="card",
            card_brand="visa",
            card_last4="1234",
        )

    def event(self, status="PAYMENT_SUCCESS"):
        payload = {
            "id": self.provider_id,
            "paymentStatus": status,
            "requestReferenceNumber": self.evidence.request_reference,
            "totalAmount": {"value": "1.00", "currency": "PHP"},
        }
        with patch("apps.payments.tasks.dispatch_maya_event"):
            accept_maya_delivery(payload, b"fixture")
        return PaymentProviderEvent.objects.get(PWEV_TYPE=status)

    def assert_pending(self):
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "pending")
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "not_started")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())


class MayaConfirmationTests(ConfirmationFixtures, TestCase):
    def test_exact_verified_success_marks_paid_once_without_activation(self):
        event = self.event()
        with patch(RETRIEVE, return_value=self.evidence) as retrieve:
            process_maya_delivery(event.pk)
            process_maya_delivery(self.event().pk)
        retrieve.assert_called_once_with(mode="test", payment_id=self.provider_id)
        self.payment.refresh_from_db()
        self.checkout.refresh_from_db()
        event.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "pending")
        self.assertEqual(self.payment.PYMT_PAID_AT, self.evidence.paid_at)
        self.assertIsNotNone(self.payment.PYMT_VERIFIED_AT)
        self.assertEqual(self.payment.PYMT_PROVIDER_PAYMENT_ID, self.provider_id)
        self.assertEqual(self.payment.PYMT_CARD_LAST4, "1234")
        self.assertIsNone(self.payment.PYMT_PROVIDER_INTENT_ID)
        self.assertEqual(self.checkout.PCHK_STATE, "completed")
        self.assertIsNone(self.checkout.PCHK_INTENT_ID)
        self.assertIsNone(self.checkout.PCHK_INTENT_STATUS)
        self.assertEqual(event.PWEV_STATE, "processed")
        self.assertEqual(event.PYMT_ID_id, self.payment.pk)
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
        self.assertIsNone(PaymentService.get_active_paid_entitlement(self.user))

    def test_wrong_amount_currency_id_reference_or_non_success_cannot_mark_paid(self):
        event = self.event()
        for fields in (
            {"amount_centavos": 101},
            {"currency": "USD"},
            {"payment_id": str(uuid4())},
            {"request_reference": str(uuid4())},
            {"status": "PAYMENT_FAILED"},
        ):
            with self.subTest(fields=fields):
                with patch(RETRIEVE, return_value=replace(self.evidence, **fields)):
                    process_maya_delivery(event.pk)
                event.refresh_from_db()
                self.assertEqual(event.PWEV_STATE, "needs_attention")
                self.assert_pending()
                PaymentProviderEvent.objects.filter(pk=event.pk).update(PWEV_STATE="queued")

    def test_wrong_local_provider_or_mode_cannot_mark_paid(self):
        event = self.event()
        for provider, mode in (("paymongo", "test"), ("maya", "live")):
            with self.subTest(provider=provider, mode=mode):
                Payment.objects.filter(pk=self.payment.pk).update(PYMT_PROVIDER=provider, PYMT_MODE=mode)
                with patch(RETRIEVE, return_value=self.evidence):
                    process_maya_delivery(event.pk)
                event.refresh_from_db()
                self.assertEqual(event.PWEV_STATE, "needs_attention")
                self.assert_pending()
                PaymentProviderEvent.objects.filter(pk=event.pk).update(PWEV_STATE="queued")

    def test_failed_then_success_can_still_mark_paid(self):
        failure = self.event("PAYMENT_FAILED")
        with patch(RETRIEVE, return_value=replace(self.evidence, status="PAYMENT_FAILED")):
            process_maya_delivery(failure.pk)
        self.assert_pending()
        self.checkout.refresh_from_db()
        self.assertEqual(self.checkout.PCHK_PROVIDER_STATUS, "PAYMENT_FAILED")
        success = self.event()
        with patch(RETRIEVE, return_value=self.evidence):
            process_maya_delivery(success.pk)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")

    def test_success_then_late_terminal_events_never_regress_paid(self):
        success = self.event()
        with patch(RETRIEVE, return_value=self.evidence):
            process_maya_delivery(success.pk)
        for status in ("PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED"):
            late = self.event(status)
            with patch(RETRIEVE, return_value=replace(self.evidence, status=status)):
                process_maya_delivery(late.pk)
            late.refresh_from_db()
            self.assertEqual(late.PWEV_STATE, "ignored")
            self.assertEqual(late.PWEV_LAST_ERROR, "already_paid")
        self.payment.refresh_from_db()
        self.checkout.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertEqual(self.checkout.PCHK_PROVIDER_STATUS, "PAYMENT_SUCCESS")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    def test_timeout_and_stale_lease_are_recoverable(self):
        event = self.event()
        self.assertEqual(due_maya_event_ids(), [event.pk])
        with patch(RETRIEVE, side_effect=MayaPaymentUnavailable):
            process_maya_delivery(event.pk)
        event.refresh_from_db()
        self.assertEqual(event.PWEV_STATE, "queued")
        self.assertIsNotNone(event.PWEV_RETRY_AT)
        self.assertEqual(due_maya_event_ids(), [])
        self.assert_pending()
        PaymentProviderEvent.objects.filter(pk=event.pk).update(
            PWEV_STATE="processing",
            PWEV_LEASE_UNTIL=timezone.now() - timedelta(seconds=1),
        )
        with patch("apps.payments.tasks.dispatch_maya_event", return_value=True) as dispatch:
            recover_maya_events()
        dispatch.assert_called_once_with(event.pk)
        with patch(RETRIEVE, return_value=self.evidence):
            process_maya_delivery(event.pk)
        event.refresh_from_db()
        self.assertEqual(event.PWEV_ATTEMPTS, 2)
        self.assertEqual(event.PWEV_STATE, "processed")

    def test_broker_failure_keeps_persisted_event_due(self):
        event = self.event()
        with patch("apps.payments.tasks.process_maya_event") as task:
            task.app.connection_for_write.side_effect = OSError("broker offline")
            self.assertFalse(dispatch_maya_event(event.pk))
        self.assertEqual(due_maya_event_ids(), [event.pk])


class MayaConfirmationConcurrencyTests(ConfirmationFixtures, TransactionTestCase):
    def setUp(self):
        self.setUpTestData()
        super().setUp()

    def test_concurrent_workers_do_one_retrieval_and_transition(self):
        self.assertEqual(connection.vendor, "postgresql")
        event = self.event()
        claimed = Event()
        release = Event()

        def retrieve(**kwargs):
            claimed.set()
            if not release.wait(timeout=10):
                raise TimeoutError()
            return self.evidence

        def process():
            try:
                process_maya_delivery(event.pk)
            finally:
                connections.close_all()

        with patch(RETRIEVE, side_effect=retrieve) as lookup:
            with ThreadPoolExecutor(max_workers=2) as pool:
                leader = pool.submit(process)
                try:
                    self.assertTrue(claimed.wait(timeout=10))
                    pool.submit(process).result(timeout=10)
                finally:
                    release.set()
                leader.result(timeout=10)
        lookup.assert_called_once()
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
