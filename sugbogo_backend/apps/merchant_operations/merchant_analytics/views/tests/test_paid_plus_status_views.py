from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.payments.models import Payment, PaymentCheckoutSession
from apps.payments.services.payment_service import PaymentService

from ...models import DemoMerchantPlusEntitlement, PaidMerchantPlusEntitlement
from ...services.mock_plus_service import MockPlusService
from ...services.tests.fixtures import MerchantAnalyticsFixtures


@override_settings(
    PAYMENT_MODE="test",
    PAYMENT_PROVIDER="paymongo",
    MERCHANT_PLUS_ENFORCED=True,
    MERCHANT_PLUS_MOCK_ENABLED=False,
)
class PaidPlusStatusViewTests(MerchantAnalyticsFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("merchant-plus-status")
        self.client.force_authenticate(self.merchant_a)

    def grant(self):
        now = timezone.now()
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        intent_id = None
        if payment.PYMT_PROVIDER == "paymongo":
            intent_id = "pi_status"
        Payment.objects.filter(pk=payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_FULFILMENT_STATUS="fulfilled",
            PYMT_PROVIDER_PAYMENT_ID="pay_status",
            PYMT_PROVIDER_INTENT_ID=intent_id,
            PYMT_PAID_AT=now,
            PYMT_VERIFIED_AT=now,
            PYMT_FULFILLED_AT=now,
        )
        entitlement = PaidMerchantPlusEntitlement.objects.create(
            BUSN_ID=self.business_a,
            PYMT_ID=payment,
            MPPE_STARTS_AT=now,
            MPPE_EXPIRES_AT=now + timedelta(days=30),
        )
        return payment, entitlement

    def test_status_adds_fixed_product_without_creating_records(self):
        data = self.client.get(self.url).data["data"]
        self.assertEqual(data["access_source"], "none")
        self.assertEqual(data["payment_mode"], "test")
        self.assertFalse(data["checkout_enabled"])
        self.assertTrue(data["purchase_eligible"])
        self.assertEqual(data["product"]["amount_centavos"], 100)
        self.assertEqual(data["product"]["access_duration_days"], 30)
        self.assertIsNone(data["paid_payment_reference"])
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())

    def test_paid_access_source_dates_and_reference_are_authoritative(self):
        payment, entitlement = self.grant()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(data["has_plus_access"])
        self.assertEqual(data["access_source"], "paymongo_test")
        self.assertTrue(data["is_simulation"])
        self.assertEqual(data["paid_payment_id"], payment.pk)
        self.assertEqual(data["paid_payment_reference"], str(payment.PYMT_REFERENCE))
        self.assertIsNotNone(data["entitlement_expires_at"])
        self.assertFalse(data["purchase_eligible"])
        self.assertEqual(data["purchase_ineligibility_reason"], "paid_access_active")
        self.assertEqual(
            entitlement.MPPE_EXPIRES_AT - entitlement.MPPE_STARTS_AT,
            timedelta(days=30),
        )
        self.assertFalse(DemoMerchantPlusEntitlement.objects.exists())

    def test_mode_switch_never_reports_test_grant_as_live(self):
        self.grant()
        with override_settings(PAYMENT_MODE="live"):
            data = self.client.get(self.url).data["data"]
            self.assertFalse(data["has_plus_access"])
            self.assertEqual(data["access_source"], "none")
            self.assertEqual(data["payment_mode"], "live")
            self.assertIsNone(data["paid_payment_id"])

    def test_active_provider_switch_preserves_historical_paymongo_access(self):
        payment, _ = self.grant()
        with override_settings(PAYMENT_PROVIDER="maya"):
            data = self.client.get(self.url).data["data"]
        self.assertTrue(data["has_plus_access"])
        self.assertEqual(data["access_source"], "paymongo_test")
        self.assertEqual(data["paid_payment_id"], payment.pk)

    def test_maya_test_access_comes_from_the_paid_entitlement(self):
        with override_settings(PAYMENT_PROVIDER="maya"):
            self.assertFalse(self.client.get(self.url).data["data"]["has_plus_access"])
            payment, _ = self.grant()
            data = self.client.get(self.url).data["data"]
        self.assertTrue(data["has_plus_access"])
        self.assertEqual(data["access_source"], "maya_test")
        self.assertTrue(data["is_simulation"])
        self.assertEqual(data["paid_payment_id"], payment.pk)
        with override_settings(PAYMENT_MODE="live"):
            self.assertFalse(self.client.get(self.url).data["data"]["has_plus_access"])

    def test_pending_payment_reference_is_private_to_owner(self):
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        PaymentCheckoutSession.objects.create(
            PYMT_ID=payment,
            PCHK_PROVIDER="paymongo",
            PCHK_MODE="test",
            PCHK_STATE="creation_unknown",
        )
        with override_settings(PAYMENT_PROVIDER="maya"):
            data = self.client.get(self.url).data["data"]
        self.assertEqual(data["unresolved_payment_id"], payment.pk)
        self.assertEqual(data["unresolved_payment_reference"], str(payment.PYMT_REFERENCE))
        self.assertEqual(data["unresolved_payment_provider"], "paymongo")
        self.assertEqual(data["unresolved_payment_mode"], "test")
        self.assertEqual(data["unresolved_payment_status"], "pending")
        self.assertEqual(data["unresolved_fulfilment_status"], "not_started")
        self.assertEqual(data["unresolved_checkout_status"], "creation_unknown")
        self.client.force_authenticate(self.merchant_b)
        data = self.client.get(self.url).data["data"]
        self.assertIsNone(data["unresolved_payment_id"])
        self.assertIsNone(data["unresolved_payment_provider"])

    def test_demonstration_configuration_never_treats_mock_grant_as_paid(self):
        with override_settings(MERCHANT_PLUS_MOCK_ENABLED=True):
            MockPlusService.activate(self.merchant_a, "success")
        data = self.client.get(self.url).data["data"]
        self.assertEqual(data["stored_demo_state"], "active")
        self.assertFalse(data["has_plus_access"])
        self.assertEqual(data["access_source"], "none")
        self.assertIsNone(data["paid_payment_id"])

    def test_paid_access_reaches_existing_analytics_gate(self):
        self.grant()
        response = self.client.get(reverse("merchant-analytics-premium-specialties"))
        self.assertEqual(response.status_code, 200)

    def test_status_still_rejects_input_overrides(self):
        response = self.client.get(self.url, {"amount": 1, "mode": "live"})
        self.assertEqual(response.status_code, 400)

    def test_live_source_is_not_marked_simulated(self):
        with override_settings(PAYMENT_MODE="live"):
            self.grant()
            data = self.client.get(self.url).data["data"]
        self.assertEqual(data["access_source"], "paymongo_live")
        self.assertFalse(data["is_simulation"])
