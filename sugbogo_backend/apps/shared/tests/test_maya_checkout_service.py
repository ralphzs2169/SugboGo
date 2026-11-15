import json
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.maya_checkout_service import (
    MayaCheckoutService,
    MayaConfigurationError,
    MayaCreationRejected,
    MayaCreationUnknown,
)
from apps.shared.tests.test_paymongo_service import provider_response


CHECKOUT_ID = "e732f996-cb87-4120-b712-166d8183c01d"
CHECKOUT_URL = "https://payments-web-sandbox.paymaya.com/v2/checkout?opaque=a%2Bb#continue"


def maya_response(
    payload=None,
    **options,
):
    if payload is None:
        payload = {
            "checkoutId": CHECKOUT_ID,
            "redirectUrl": CHECKOUT_URL,
        }
    return provider_response(payload, **options)


@override_settings(
    MAYA_SANDBOX_PUBLIC_KEY="pk-fixture-only",
    MAYA_SANDBOX_SECRET_KEY="sk-fixture-only",
    MAYA_SANDBOX_API_BASE_URL="https://untrusted.example",
)
class MayaCheckoutServiceTests(SimpleTestCase):
    def setUp(self):
        patcher = patch("apps.shared.services.maya_checkout_service.requests.post")
        self.post = patcher.start()
        self.addCleanup(patcher.stop)
        self.post.return_value = maya_response()
        self.reference = UUID("5fc10b93-bdbd-4f31-b31d-4575a3785009")
        self.arguments = {
            "mode": "test",
            "operation_reference": self.reference,
            "product_name": "Merchant Plus",
            "amount_centavos": 100,
            "currency": "PHP",
            "success_url": "https://sugbogo.example/return?outcome=success",
            "failure_url": "https://sugbogo.example/return?outcome=failure",
            "cancel_url": "https://sugbogo.example/return?outcome=cancel",
        }

    def test_exact_sandbox_request_and_minimal_response(self):
        result = MayaCheckoutService.create_checkout(**self.arguments)
        self.post.assert_called_once()
        self.assertEqual(
            self.post.call_args.args,
            ("https://pg-sandbox.paymaya.com/checkout/v1/checkouts",),
        )
        options = self.post.call_args.kwargs
        self.assertEqual(options["auth"].username, "pk-fixture-only")
        self.assertEqual(options["auth"].password, "")
        self.assertEqual(options["headers"]["Content-Type"], "application/json")
        self.assertEqual(options["timeout"], (3.05, 10))
        self.assertTrue(options["verify"])
        self.assertTrue(options["stream"])
        self.assertFalse(options["allow_redirects"])
        payload = json.loads(options["data"], parse_float=Decimal)
        self.assertEqual(payload, {
            "totalAmount": {"value": Decimal("1.00"), "currency": "PHP"},
            "items": [{
                "name": "Merchant Plus",
                "quantity": 1,
                "amount": {"value": Decimal("1.00")},
                "totalAmount": {"value": Decimal("1.00")},
            }],
            "requestReferenceNumber": str(self.reference),
            "redirectUrl": {
                "success": self.arguments["success_url"],
                "failure": self.arguments["failure_url"],
                "cancel": self.arguments["cancel_url"],
            },
        })
        self.assertEqual(payload["totalAmount"]["value"].as_tuple().exponent, -2)
        self.assertEqual(result.checkout_id, CHECKOUT_ID)
        self.assertEqual(result.checkout_url, CHECKOUT_URL)
        self.assertEqual(result.status, "")

    def test_accepts_the_maya_ph_sandbox_host_returned_by_checkout(self):
        checkout_url = "https://payments-web-sandbox.maya.ph/v2/checkout?id=fixture"
        self.post.return_value = maya_response({
            "checkoutId": CHECKOUT_ID,
            "redirectUrl": checkout_url,
        })

        checkout = MayaCheckoutService.create_checkout(**self.arguments)

        self.assertEqual(checkout.checkout_id, CHECKOUT_ID)
        self.assertEqual(checkout.checkout_url, checkout_url)
        self.post.assert_called_once()

    def test_fractional_centavos_convert_without_rounding_or_json_string(self):
        self.arguments["amount_centavos"] = 129
        self.arguments["product_name"] = 'Merchant "Plus"'
        MayaCheckoutService.create_checkout(**self.arguments)
        payload = json.loads(self.post.call_args.kwargs["data"], parse_float=Decimal)
        self.assertEqual(payload["totalAmount"]["value"], Decimal("1.29"))
        self.assertEqual(payload["items"][0]["name"], self.arguments["product_name"])
        self.assertEqual(payload["items"][0]["amount"]["value"], Decimal("1.29"))
        self.assertEqual(payload["items"][0]["totalAmount"]["value"], Decimal("1.29"))

    def test_rejects_live_mode_invalid_inputs_and_nonpublic_credentials_before_http(self):
        for override in (
            {"mode": "live"},
            {"operation_reference": "client-reference"},
            {"amount_centavos": 0},
            {"currency": "USD"},
            {"failure_url": "http://sugbogo.example/return"},
        ):
            with self.subTest(override=override):
                with self.assertRaises(MayaConfigurationError):
                    MayaCheckoutService.create_checkout(**{
                        **self.arguments,
                        **override,
                    })
        with override_settings(MAYA_SANDBOX_PUBLIC_KEY="sk-fixture-only"):
            with self.assertRaises(MayaConfigurationError) as error:
                MayaCheckoutService.create_checkout(**self.arguments)
            self.assertNotIn("sk-fixture-only", str(error.exception))
        self.post.assert_not_called()

    def test_reported_status_and_matching_reference_are_preserved(self):
        self.post.return_value = maya_response({
            "checkoutId": CHECKOUT_ID,
            "redirectUrl": CHECKOUT_URL,
            "paymentStatus": "PENDING_TOKEN",
            "requestReferenceNumber": str(self.reference),
        })
        result = MayaCheckoutService.create_checkout(**self.arguments)
        self.assertEqual(result.status, "PENDING_TOKEN")

    def test_rejects_malformed_or_untrusted_success(self):
        for payload in (
            {"checkoutId": "not-a-uuid", "redirectUrl": CHECKOUT_URL},
            {"checkoutId": CHECKOUT_ID},
            {"checkoutId": CHECKOUT_ID, "redirectUrl": CHECKOUT_URL.replace("https:", "http:")},
            {"checkoutId": CHECKOUT_ID, "redirectUrl": "https://payments.maya.ph/v2/checkout"},
            {
                "checkoutId": CHECKOUT_ID,
                "redirectUrl": "https://payments-web-sandbox.maya.ph.evil.test/v2/checkout",
            },
            {"checkoutId": CHECKOUT_ID, "redirectUrl": "https://payments-web-sandbox.paymaya.com@evil.test/x"},
            {
                "checkoutId": CHECKOUT_ID,
                "redirectUrl": CHECKOUT_URL,
                "requestReferenceNumber": str(UUID(int=1)),
            },
        ):
            with self.subTest(payload=payload):
                self.post.return_value = maya_response(payload)
                with self.assertRaises(MayaCreationUnknown):
                    MayaCheckoutService.create_checkout(**self.arguments)

    def test_known_validation_and_authentication_rejections_are_sanitized(self):
        for http_status, code, classification in (
            (400, "2553", "provider_validation_rejected"),
            (422, 2553, "provider_validation_rejected"),
            (401, "K003", "provider_authentication_rejected"),
            (403, "K007", "provider_authentication_rejected"),
        ):
            with self.subTest(http_status=http_status, code=code):
                self.post.return_value = maya_response(
                    {"code": code, "message": "pk-fixture-only"},
                    status_code=http_status,
                )
                with self.assertRaisesMessage(MayaCreationRejected, classification) as error:
                    MayaCheckoutService.create_checkout(**self.arguments)
                self.assertNotIn("pk-fixture-only", str(error.exception))

    def test_ambiguous_http_errors_and_malformed_or_oversized_bodies_are_unknown(self):
        for response in (
            maya_response({"code": "K999", "message": "failure"}, status_code=401),
            maya_response(
                {"code": "2553", "message": "invalid", "checkoutId": CHECKOUT_ID},
                status_code=400,
            ),
            maya_response(status_code=302),
            maya_response(status_code=429),
            maya_response(status_code=502),
            maya_response(body=b"not JSON pk-fixture-only"),
            maya_response(body=b"x" * 65537),
        ):
            self.post.reset_mock()
            self.post.return_value = response
            with self.assertRaises(MayaCreationUnknown) as error:
                MayaCheckoutService.create_checkout(**self.arguments)
            self.assertNotIn("pk-fixture-only", str(error.exception))
            self.post.assert_called_once()

    def test_uncertain_transport_and_stream_failures_are_sanitized_and_never_retried(self):
        for failure in (
            requests.ReadTimeout("pk-fixture-only"),
            requests.ConnectionError("pk-fixture-only"),
        ):
            self.post.reset_mock()
            self.post.side_effect = failure
            with self.assertRaises(MayaCreationUnknown) as error:
                MayaCheckoutService.create_checkout(**self.arguments)
            self.assertNotIn("pk-fixture-only", str(error.exception))
            self.post.assert_called_once()
        self.post.reset_mock(side_effect=True)
        self.post.return_value.iter_content.side_effect = requests.exceptions.ChunkedEncodingError(
            "pk-fixture-only",
        )
        with self.assertRaises(MayaCreationUnknown):
            MayaCheckoutService.create_checkout(**self.arguments)
        self.post.assert_called_once()
