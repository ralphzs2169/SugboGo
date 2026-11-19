from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.payments.models import Payment, PaymentCheckoutSession
from apps.payments.services.payment_service import PaymentService

from ...models import PaidMerchantPlusEntitlement
from ...services.tests.fixtures import MerchantAnalyticsFixtures


def grant_paid_plus(
    user,
    business,
):
    """Create fulfilled access in the configured provider and mode."""
    now = timezone.now()
    payment, _ = PaymentService.create_or_get_payment(user)
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
        BUSN_ID=business,
        PYMT_ID=payment,
        MPPE_STARTS_AT=now,
        MPPE_EXPIRES_AT=now + timedelta(days=30),
    )
    return payment, entitlement


@override_settings(
    PAYMENT_MODE="test",
    PAYMENT_PROVIDER="paymongo",
    MERCHANT_PLUS_ENFORCED=True,
)
class PaidPlusStatusViewTests(MerchantAnalyticsFixtures, APITestCase):
    def test_checkout_outcome_comes_only_from_stored_evidence(self):
        with override_settings(PAYMENT_PROVIDER="maya"):
            payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        checkout = PaymentCheckoutSession.objects.create(
            PYMT_ID=payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_PROVIDER_SESSION_ID="4ecb2bc0-09da-4ee5-9914-8ede80203a40",
            PCHK_CHECKOUT_URL="https://payments-web-sandbox.paymaya.com/fixture",
        )
        cases = (
            ("ready", "PENDING_TOKEN", "pending"),
            ("ready", "PAYMENT_CANCELLED", "cancelled"),
            ("ready", "PAYMENT_FAILED", "failed"),
            ("expired", "PAYMENT_EXPIRED", "expired"),
            ("creation_unknown", "", "unknown"),
        )
        for state, provider_status, expected in cases:
            with self.subTest(state=state, provider_status=provider_status):
                PaymentCheckoutSession.objects.filter(pk=checkout.pk).update(
                    PCHK_STATE=state,
                    PCHK_PROVIDER_STATUS=provider_status,
                )
                data = self.client.get(self.url).data["data"]
                self.assertEqual(data["checkout_outcome"], expected)
                self.assertEqual(data["unresolved_payment_status"], "pending")
                self.assertFalse(data["has_plus_access"])
        now = timezone.now()
        Payment.objects.filter(pk=payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_FULFILMENT_STATUS="pending",
            PYMT_PROVIDER_PAYMENT_ID="verified-payment",
            PYMT_PAID_AT=now,
            PYMT_VERIFIED_AT=now,
        )
        PaymentCheckoutSession.objects.filter(pk=checkout.pk).update(
            PCHK_PROVIDER_STATUS="PAYMENT_CANCELLED",
        )
        data = self.client.get(self.url).data["data"]
        self.assertIsNone(data["checkout_outcome"])
        self.assertEqual(data["unresolved_payment_status"], "paid")

    def setUp(self):
        super().setUp()
        self.url = reverse("merchant-plus-status")
        self.client.force_authenticate(self.merchant_a)

    def grant(self):
        return grant_paid_plus(self.merchant_a, self.business_a)

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

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_preview_and_legacy_status_fields_are_compatible(self):
        data = self.client.get(self.url).data["data"]
        self.assertTrue(data["has_plus_access"])
        self.assertEqual(data["access_source"], "preview")
        self.assertEqual(data["effective_tier"], "plus")
        self.assertFalse(data["enforcement_enabled"])
        self.assertEqual(data["stored_demo_state"], "not_created")
        self.assertFalse(data["mock_enabled"])
        self.assertIsNone(data["activated_at"])
        self.assertIsNone(data["reset_at"])
        self.assertIsNone(data["updated_at"])
        self.assertIsNone(data["paid_payment_id"])

    def test_mock_mutations_are_unavailable(self):
        base_url = self.url.removesuffix("status/")
        for route in ("mock-activation/", "mock-reset/"):
            with self.subTest(route=route):
                response = self.client.post(
                    f"{base_url}{route}",
                    {},
                    format="json",
                )
                self.assertEqual(response.status_code, 404)

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
