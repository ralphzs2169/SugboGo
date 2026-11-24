from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.core.cache import cache
from django.db import connection, connections
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.payments.models import Payment, PaymentCheckoutSession
from apps.payments.services.fulfilment_service import fulfil_paid_merchant_plus_payment
from apps.payments.services.maya_reconciliation_service import reconcile_merchant_plus_payment
from apps.shared.services.maya_checkout_service import MayaPaymentUnavailable
from apps.users.models import User
from apps.business.models import Business

from .test_maya_confirmation import ConfirmationFixtures, RETRIEVE


class MayaReconciliationTests(ConfirmationFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(self.settings(
            MAYA_WEBHOOK_ENABLED=False,
            CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
        ))
        cache.clear()
        self.client.force_authenticate(self.merchant_a)
        self.url = reverse("merchant-plus-payment-reconcile")

    def reconcile(self):
        return self.client.post(self.url, {}, format="json")

    def test_success_dispatches_existing_fulfilment_after_commit_once(self):
        with patch(RETRIEVE, return_value=self.evidence) as retrieve:
            with patch("apps.payments.tasks.dispatch_merchant_plus_fulfilment") as dispatch:
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.reconcile()
                    dispatch.assert_not_called()
                dispatch.assert_called_once_with(self.payment.pk)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"]["unresolved_payment_status"], "paid")
                self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
                self.assertEqual(self.reconcile().status_code, 200)
                dispatch.assert_called_once()
            with patch("apps.payments.services.fulfilment_service._notify_activation"):
                first = fulfil_paid_merchant_plus_payment(self.payment.pk)
                second = fulfil_paid_merchant_plus_payment(self.payment.pk)
            self.assertEqual(first.pk, second.pk)
            response = self.reconcile()
            self.assertEqual(response.status_code, 200)
            data = response.data["data"]
            self.assertTrue(data["has_plus_access"])
            self.assertEqual(data["effective_tier"], "plus")
            self.assertEqual(data["access_source"], "maya_test")
            self.assertEqual(data["paid_payment_id"], self.payment.pk)
            self.assertEqual(data["stored_demo_state"], "not_created")
            self.assertFalse(data["mock_enabled"])
            self.assertIsNone(data["reset_at"])
            self.assertIsNone(data["updated_at"])
            retrieve.assert_called_once_with(mode="test", payment_id=self.provider_id)
        self.assertEqual(PaidMerchantPlusEntitlement.objects.count(), 1)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(PaymentCheckoutSession.objects.count(), 1)

    def test_pending_observation_does_not_confirm_payment(self):
        with patch(RETRIEVE, return_value=replace(self.evidence, status="PENDING_PAYMENT")):
            response = self.reconcile()
        self.assertEqual(response.status_code, 200)
        self.assert_pending()
        self.checkout.refresh_from_db()
        self.assertEqual(self.checkout.PCHK_PROVIDER_STATUS, "PENDING_PAYMENT")

    def test_creation_unknown_with_a_stored_provider_identity_can_be_verified(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_STATE="creation_unknown",
        )
        with patch(RETRIEVE, return_value=self.evidence):
            self.assertEqual(self.reconcile().status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")

    def test_terminal_evidence_is_not_regressed_by_an_inflight_pending_lookup(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_STATE="expired",
            PCHK_PROVIDER_STATUS="PAYMENT_EXPIRED",
        )
        with patch(RETRIEVE, return_value=replace(self.evidence, status="PENDING_PAYMENT")):
            self.assertEqual(self.reconcile().status_code, 200)
        self.checkout.refresh_from_db()
        self.assertEqual(self.checkout.PCHK_PROVIDER_STATUS, "PAYMENT_EXPIRED")
        self.assert_pending()

    def test_bad_evidence_preserves_unresolved_state(self):
        for fields in (
            {"amount_centavos": 101},
            {"currency": "USD"},
            {"payment_id": str(uuid4())},
            {"request_reference": str(uuid4())},
            {"paid_at": None},
            {"status": "AUTHORIZED"},
        ):
            with self.subTest(fields=fields):
                cache.clear()
                with patch(RETRIEVE, return_value=replace(self.evidence, **fields)):
                    self.assertEqual(self.reconcile().status_code, 409)
                self.assert_pending()

    def test_temporary_lookup_failure_is_recoverable(self):
        with patch(RETRIEVE, side_effect=MayaPaymentUnavailable()):
            self.assertEqual(self.reconcile().status_code, 503)
        self.assert_pending()

    def test_definitively_failed_creation_returns_stored_status_without_lookup(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID=None,
            PCHK_STATE=PaymentCheckoutSession.State.CREATION_FAILED,
            PCHK_LAST_ERROR="provider_validation_rejected",
        )
        with (
            patch(RETRIEVE) as retrieve,
            patch(f"{RETRIEVE}_by_reference") as reference_lookup,
        ):
            response = self.reconcile()
            stored_status = self.client.get(reverse("merchant-plus-status"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(stored_status.status_code, 200)
        self.assertEqual(response.data["data"], stored_status.data["data"])
        self.assertEqual(
            response.data["data"]["unresolved_checkout_status"],
            PaymentCheckoutSession.State.CREATION_FAILED,
        )
        retrieve.assert_not_called()
        reference_lookup.assert_not_called()
        self.assert_pending()

    def test_missing_identity_uses_reference_without_releasing_purchase(self):
        with patch(RETRIEVE) as retrieve, patch(
            "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
            return_value=None,
        ) as reference_lookup:
            self.client.force_authenticate(self.merchant_b)
            self.assertEqual(self.reconcile().status_code, 200)
            reference_lookup.assert_not_called()
            self.client.force_authenticate(self.merchant_a)
            PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
                PCHK_PROVIDER_SESSION_ID=None,
                PCHK_STATE="creation_unknown",
            )
            self.assertEqual(self.reconcile().status_code, 503)
            reference_lookup.assert_called_once()
            retrieve.assert_not_called()
        self.assert_pending()

    def test_reference_recovery_verifies_by_id_then_marks_paid_once(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID=None,
            PCHK_CHECKOUT_URL="",
            PCHK_STATE="creation_unknown",
        )
        with patch(
            "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
            return_value=self.evidence,
        ) as reference_lookup, patch(RETRIEVE, return_value=self.evidence) as retrieve:
            with patch(
                "apps.payments.tasks.dispatch_merchant_plus_fulfilment",
            ) as dispatch:
                with self.captureOnCommitCallbacks(execute=True):
                    self.assertEqual(self.reconcile().status_code, 200)
                    self.assertEqual(self.reconcile().status_code, 200)
                dispatch.assert_called_once_with(self.payment.pk)
            reference_lookup.assert_called_once_with(
                mode="test",
                operation_reference=self.checkout.PCHK_OPERATION_REFERENCE,
            )
            retrieve.assert_called_once_with(mode="test", payment_id=self.provider_id)
        self.checkout.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.checkout.PCHK_PROVIDER_SESSION_ID, self.provider_id)
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    def test_reference_recovery_does_not_persist_invalid_purchase_evidence(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID=None,
            PCHK_STATE="creation_unknown",
        )
        for fields in (
            {"amount_centavos": 101},
            {"currency": "USD"},
            {"request_reference": str(uuid4())},
        ):
            with self.subTest(fields=fields):
                cache.clear()
                with patch(
                    "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
                    return_value=self.evidence,
                ), patch(RETRIEVE, return_value=replace(self.evidence, **fields)):
                    self.assertEqual(self.reconcile().status_code, 409)
                self.checkout.refresh_from_db()
                self.assertIsNone(self.checkout.PCHK_PROVIDER_SESSION_ID)
                self.assert_pending()

    def test_reference_service_unavailable_does_not_silently_claim_checked(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID=None,
            PCHK_STATE="creation_unknown",
        )
        with patch(
            "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
            side_effect=MayaPaymentUnavailable(),
        ) as reference_lookup, patch(RETRIEVE) as retrieve:
            response = self.reconcile()

        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.data["success"])
        self.assertEqual(
            response.data["code"],
            "PAYMENT_RECONCILIATION_UNAVAILABLE",
        )
        reference_lookup.assert_called_once_with(
            mode="test",
            operation_reference=self.checkout.PCHK_OPERATION_REFERENCE,
        )
        retrieve.assert_not_called()
        self.assert_pending()
        self.checkout.refresh_from_db()
        self.assertEqual(
            self.checkout.PCHK_STATE,
            PaymentCheckoutSession.State.CREATION_UNKNOWN,
        )
        self.assertIsNone(self.checkout.PCHK_PROVIDER_SESSION_ID)

    def test_recovered_terminal_unpaid_checkout_uses_existing_explicit_retry_rules(self):
        from apps.payments.services.checkout_service import CheckoutService

        for status in ("PAYMENT_FAILED", "PAYMENT_CANCELLED", "PAYMENT_EXPIRED"):
            with self.subTest(status=status):
                cache.clear()
                PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
                    PCHK_PROVIDER_SESSION_ID=None,
                    PCHK_CHECKOUT_URL="",
                    PCHK_STATE="creation_unknown",
                    PCHK_LAST_ERROR="provider_response_unusable",
                    PCHK_PROVIDER_STATUS="",
                )
                with patch(
                    "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
                    return_value=self.evidence,
                ), patch(RETRIEVE, return_value=replace(self.evidence, status=status)):
                    self.assertEqual(self.reconcile().status_code, 200)
                self.checkout.refresh_from_db()
                self.payment.refresh_from_db()
                self.assertTrue(CheckoutService.can_retry(self.payment, self.checkout))
                self.assert_pending()

    def test_authentication_role_and_client_evidence_are_rejected(self):
        with patch(RETRIEVE) as retrieve:
            self.client.force_authenticate(None)
            self.assertEqual(self.reconcile().status_code, 401)
            self.client.force_authenticate(User(
                USER_ID=900,
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            ))
            self.assertEqual(self.reconcile().status_code, 403)
            self.client.force_authenticate(self.merchant_a)
            for body in (
                {"payment_id": self.payment.pk},
                {"payment_status": "paid"},
                {"provider_payment_id": self.provider_id},
                {"amount": 100},
            ):
                self.assertEqual(self.client.post(self.url, body, format="json").status_code, 400)
            retrieve.assert_not_called()

    def test_terminal_unpaid_observation_can_be_superseded_by_verified_success(self):
        for status in ("PAYMENT_FAILED", "PAYMENT_CANCELLED", "PAYMENT_EXPIRED"):
            with self.subTest(status=status):
                cache.clear()
                with patch(RETRIEVE, return_value=replace(self.evidence, status=status)):
                    self.assertEqual(self.reconcile().status_code, 200)
                self.assert_pending()
        with patch(RETRIEVE, return_value=self.evidence):
            self.assertEqual(self.reconcile().status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")

    def test_wrong_provider_or_environment_never_confirms(self):
        for provider, mode in (("paymongo", "test"), ("maya", "live")):
            with self.subTest(provider=provider, mode=mode):
                Payment.objects.filter(pk=self.payment.pk).update(
                    PYMT_PROVIDER=provider,
                    PYMT_MODE=mode,
                )
                with patch(RETRIEVE) as retrieve:
                    self.assertEqual(self.reconcile().status_code, 200)
                    retrieve.assert_not_called()
                self.assert_pending()

    def test_ownership_change_during_provider_lookup_cannot_confirm_payment(self):
        other_owner = type(self).user("new-owner", User.UserRole.MERCHANT)

        def retrieve(**kwargs):
            Business.objects.filter(pk=self.business_a.pk).update(USER_ID=other_owner)
            return self.evidence

        with patch(RETRIEVE, side_effect=retrieve):
            self.assertEqual(self.reconcile().status_code, 403)
        self.assert_pending()


class MayaReconciliationConcurrencyTests(ConfirmationFixtures, TransactionTestCase):
    def setUp(self):
        self.setUpTestData()
        super().setUp()

    def test_simultaneous_reference_recovery_dispatches_only_once(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL locking required.")
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID=None,
            PCHK_STATE="creation_unknown",
        )
        barrier = Barrier(2)
        merchant_id = self.merchant_a.pk

        def retrieve(**kwargs):
            self.assertFalse(connection.in_atomic_block)
            barrier.wait(timeout=20)
            return self.evidence

        def reconcile(_):
            try:
                reconcile_merchant_plus_payment(User.objects.get(pk=merchant_id))
            finally:
                connections.close_all()

        with patch(
            "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment_by_reference",
            return_value=self.evidence,
        ), patch(RETRIEVE, side_effect=retrieve):
            with patch("apps.payments.tasks.dispatch_merchant_plus_fulfilment") as dispatch:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    list(pool.map(reconcile, range(2)))
                dispatch.assert_called_once_with(self.payment.pk)
        self.payment.refresh_from_db()
        self.checkout.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertEqual(self.checkout.PCHK_PROVIDER_SESSION_ID, self.provider_id)
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    def test_simultaneous_reconciliations_dispatch_only_one_financial_transition(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL locking required.")
        barrier = Barrier(2)
        merchant_id = self.merchant_a.pk

        def retrieve(**kwargs):
            self.assertFalse(connection.in_atomic_block)
            barrier.wait(timeout=20)
            return self.evidence

        def reconcile(_):
            try:
                reconcile_merchant_plus_payment(User.objects.get(pk=merchant_id))
            finally:
                connections.close_all()

        with patch(RETRIEVE, side_effect=retrieve):
            with patch("apps.payments.tasks.dispatch_merchant_plus_fulfilment") as dispatch:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    list(pool.map(reconcile, range(2)))
                dispatch.assert_called_once_with(self.payment.pk)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.PYMT_STATUS, "paid")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
