from unittest.mock import patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.maya_checkout_service import (
    MayaCheckoutService,
    MayaConfigurationError,
    MayaPaymentRejected,
    MayaPaymentUnavailable,
)
from apps.shared.tests.test_maya_checkout_service import CHECKOUT_ID, maya_response


@override_settings(MAYA_SANDBOX_SECRET_KEY="sk-synthetic", MAYA_SANDBOX_PUBLIC_KEY="pk-synthetic")
class MayaRetrievePaymentTests(SimpleTestCase):
    reference = "51835ae2-75bb-4755-8c5f-d4afd1ac36d8"
    payload = {
        "id": CHECKOUT_ID,
        "status": "COMPLETED",
        "paymentStatus": "PAYMENT_SUCCESS",
        "requestReferenceNumber": reference,
        "totalAmount": {"value": "1.00", "currency": "PHP"},
        "paymentDetails": {"paymentAt": "2026-11-15T01:00:00Z", "cardType": "visa", "last4": "2222"},
        "buyer": {"email": "fixture@example.com"},
    }

    @patch("apps.shared.services.maya_checkout_service.requests.get")
    def test_retrieve_uses_secret_key_and_returns_normalized_evidence(self, get):
        get.return_value = maya_response(self.payload)
        result = MayaCheckoutService.retrieve_payment(mode="test", payment_id=CHECKOUT_ID)
        self.assertEqual(
            get.call_args.args,
            (f"https://pg-sandbox.paymaya.com/payments/v1/payments/{CHECKOUT_ID}",),
        )
        self.assertEqual(get.call_args.kwargs["auth"].username, "sk-synthetic")
        self.assertEqual(get.call_args.kwargs["auth"].password, "")
        self.assertTrue(get.call_args.kwargs["verify"])
        self.assertFalse(get.call_args.kwargs["allow_redirects"])
        self.assertEqual(get.call_args.kwargs["timeout"], (3.05, 10))
        self.assertEqual(result.payment_id, CHECKOUT_ID)
        self.assertEqual(result.request_reference, self.reference)
        self.assertEqual(result.status, "PAYMENT_SUCCESS")
        self.assertEqual(result.amount_centavos, 100)
        self.assertEqual(result.currency, "PHP")
        self.assertEqual(result.card_last4, "2222")
        self.assertNotIn("fixture@example.com", repr(result))

    @patch("apps.shared.services.maya_checkout_service.requests.get")
    def test_rejects_fraction_of_centavo_inconsistent_money_and_false_paid_signal(self, get):
        for update in (
            {"totalAmount": {"value": "1.000000000001", "currency": "PHP"}},
            {"amount": "2.00"},
            {"isPaid": False},
        ):
            with self.subTest(update=update):
                get.return_value = maya_response({**self.payload, **update})
                with self.assertRaises(MayaPaymentRejected):
                    MayaCheckoutService.retrieve_payment(mode="test", payment_id=CHECKOUT_ID)
        get.return_value = maya_response(body=b'{"id":"first","id":"second"}')
        with self.assertRaises(MayaPaymentRejected):
            MayaCheckoutService.retrieve_payment(mode="test", payment_id=CHECKOUT_ID)

    @patch("apps.shared.services.maya_checkout_service.requests.get")
    def test_network_failure_is_retryable_and_live_never_transmits(self, get):
        with self.assertRaises(MayaConfigurationError):
            MayaCheckoutService.retrieve_payment(mode="live", payment_id=CHECKOUT_ID)
        get.assert_not_called()
        get.side_effect = requests.ReadTimeout("sk-synthetic")
        with self.assertRaises(MayaPaymentUnavailable) as raised:
            MayaCheckoutService.retrieve_payment(mode="test", payment_id=CHECKOUT_ID)
        self.assertNotIn("sk-synthetic", str(raised.exception))
