import copy
import json
from unittest.mock import MagicMock, patch

import requests
from django.test import SimpleTestCase, override_settings

from apps.shared.services.paymongo_service import (
    PayMongoConfigurationError,
    PayMongoCreationRejected,
    PayMongoCreationUnknown,
    PayMongoService,
)


def checkout_payload():
    return {
        "data": {
            "id": "cs_mock_session",
            "type": "checkout_session",
            "attributes": {
                "checkout_url": "https://checkout.paymongo.com/cs_mock_session#opaque-token",
                "livemode": False,
            },
        },
    }


def provider_response(
    payload=None,
    *,
    status_code=200,
    body=None,
):
    response = MagicMock()
    response.__enter__.return_value = response
    response.status_code = status_code
    if body is None:
        if payload is None:
            payload = checkout_payload()
        body = json.dumps(payload).encode()
    response.iter_content.return_value = [body]
    return response


@override_settings(
    PAYMONGO_MODE="live",
    PAYMONGO_TEST_SECRET_KEY="sk_test_mock_only",
    PAYMONGO_LIVE_SECRET_KEY="sk_live_mock_only",
)
class PayMongoServiceTests(SimpleTestCase):
    def setUp(self):
        patcher = patch("apps.shared.services.paymongo_service.requests.post")
        self.post = patcher.start()
        self.addCleanup(patcher.stop)
        self.post.return_value = provider_response()
        self.arguments = {
            "mode": "test",
            "payment_reference": "e1b37bb0-0000-4000-8000-000000000001",
            "operation_reference": "e1b37bb0-0000-4000-8000-000000000002",
            "product_name": "Merchant Plus",
            "amount_centavos": 100,
            "currency": "PHP",
            "payment_methods": ("gcash", "paymaya"),
            "success_url": "https://sugbogo.example/payment-return?outcome=success",
            "cancel_url": "https://sugbogo.example/payment-return?outcome=cancel",
        }

    def test_exact_v2_request_and_minimal_response(self):
        result = PayMongoService.create_checkout_session(**self.arguments)
        self.post.assert_called_once()
        self.assertEqual(
            self.post.call_args.args,
            ("https://api.paymongo.com/v2/checkout_sessions",),
        )
        options = self.post.call_args.kwargs
        self.assertEqual(options["auth"].username, "sk_test_mock_only")
        self.assertEqual(options["auth"].password, "")
        self.assertEqual(options["timeout"], (3.05, 10))
        self.assertTrue(options["verify"])
        self.assertTrue(options["stream"])
        self.assertFalse(options["allow_redirects"])
        attributes = options["json"]["data"]["attributes"]
        self.assertEqual(attributes["line_items"], [{
            "name": "Merchant Plus",
            "amount": 100,
            "currency": "PHP",
            "quantity": 1,
        }])
        self.assertEqual(attributes["payment_method_types"], ["gcash", "paymaya"])
        self.assertEqual(attributes["success_url"], self.arguments["success_url"])
        self.assertEqual(attributes["cancel_url"], self.arguments["cancel_url"])
        self.assertEqual(attributes["reference_number"], self.arguments["payment_reference"])
        self.assertEqual(attributes["description"], "Merchant Plus")
        self.assertEqual(attributes["metadata"]["operation_reference"], self.arguments["operation_reference"])
        self.assertFalse(attributes["pass_on_fees"])
        self.assertFalse(attributes["send_email_receipt"])
        self.assertEqual(result.session_id, "cs_mock_session")
        self.assertEqual(result.checkout_url, checkout_payload()["data"]["attributes"]["checkout_url"])
        self.assertEqual(result.intent_id, "")

    def test_live_record_selects_live_key_even_when_global_mode_is_test(self):
        self.arguments["mode"] = "live"
        payload = checkout_payload()
        payload["data"]["attributes"]["livemode"] = True
        self.post.return_value = provider_response(payload)
        with override_settings(PAYMONGO_MODE="test"):
            PayMongoService.create_checkout_session(**self.arguments)
        self.assertEqual(self.post.call_args.kwargs["auth"].username, "sk_live_mock_only")

    def test_wrong_mode_key_and_missing_key_fail_before_http(self):
        for value in ("", "sk_live_wrong_environment"):
            with self.subTest(value=value):
                with override_settings(PAYMONGO_TEST_SECRET_KEY=value):
                    with self.assertRaises(PayMongoConfigurationError):
                        PayMongoService.create_checkout_session(**self.arguments)
        self.post.assert_not_called()

    def test_invalid_normalized_input_is_not_sent(self):
        for field, value in (
            ("amount_centavos", 0),
            ("amount_centavos", True),
            ("currency", "USD"),
            ("payment_methods", ("unknown",)),
            ("payment_methods", ("gcash", "gcash")),
            ("success_url", "http://sugbogo.example/return"),
            ("cancel_url", "https://user:password@sugbogo.example/return"),
        ):
            with self.subTest(field=field, value=value):
                arguments = {**self.arguments, field: value}
                with self.assertRaises(PayMongoConfigurationError):
                    PayMongoService.create_checkout_session(**arguments)
        self.post.assert_not_called()

    def test_network_failures_are_unknown_and_never_retried(self):
        for error in (
            requests.ReadTimeout("sk_test_mock_only"),
            requests.ConnectTimeout("sk_test_mock_only"),
            requests.ConnectionError("sk_test_mock_only"),
            requests.exceptions.ChunkedEncodingError("sk_test_mock_only"),
        ):
            with self.subTest(error=type(error).__name__):
                self.post.reset_mock()
                self.post.side_effect = error
                with self.assertRaises(PayMongoCreationUnknown) as caught:
                    PayMongoService.create_checkout_session(**self.arguments)
                self.assertNotIn("sk_test_mock_only", str(caught.exception))
                self.post.assert_called_once()

    def test_transport_default_does_not_retry_post(self):
        with requests.Session() as session:
            adapter = session.get_adapter(PayMongoService.CHECKOUT_URL)
            self.assertEqual(adapter.max_retries.total, 0)

    def test_validated_authentication_and_validation_rejections(self):
        for status, code in (
            (400, "parameter_invalid"),
            (401, "api_key_not_found"),
            (403, "account_not_activated"),
            (422, "parameter_required"),
        ):
            with self.subTest(status=status):
                self.post.return_value = provider_response(
                    {"errors": [{"code": code, "detail": "sk_test_mock_only"}]},
                    status_code=status,
                )
                with self.assertRaises(PayMongoCreationRejected) as caught:
                    PayMongoService.create_checkout_session(**self.arguments)
                self.assertEqual(str(caught.exception), "provider_rejected")

    def test_other_http_errors_and_redirects_are_unknown(self):
        for status, payload in (
            (400, {"errors": [{"code": "unrecognized_code"}]}),
            (400, {"errors": []}),
            (401, {"data": {}, "errors": [{"code": "api_key_not_found"}]}),
            (404, {"errors": [{"code": "resource_not_found"}]}),
            (408, {}),
            (409, {}),
            (429, {}),
            (500, {}),
            (503, {}),
            (302, {}),
        ):
            with self.subTest(status=status):
                self.post.return_value = provider_response(payload, status_code=status)
                with self.assertRaises(PayMongoCreationUnknown):
                    PayMongoService.create_checkout_session(**self.arguments)

    def test_malformed_and_oversized_responses_are_unknown(self):
        for body in (b"not JSON sk_test_mock_only", b"[]", b"x" * 65537):
            with self.subTest(length=len(body)):
                self.post.return_value = provider_response(body=body)
                with self.assertRaises(PayMongoCreationUnknown) as caught:
                    PayMongoService.create_checkout_session(**self.arguments)
                self.assertNotIn("sk_test_mock_only", str(caught.exception))

    def test_stream_interruption_is_unknown(self):
        self.post.return_value.iter_content.side_effect = requests.ReadTimeout()
        with self.assertRaises(PayMongoCreationUnknown):
            PayMongoService.create_checkout_session(**self.arguments)

    def test_unsafe_checkout_urls_are_rejected(self):
        for url in (
            "http://checkout.paymongo.com/session",
            "https://checkout.paymongo.com.attacker.example/session",
            "https://checkout.paymongo.com@attacker.example/session",
            "https://user:password@checkout.paymongo.com/session",
            "https://checkout.paymongo.com:8443/session",
            "javascript:alert(1)",
            "https://checkout.paymongo.com\\@attacker.example/session",
            "https://checkout.paymongo.com/session\n",
        ):
            with self.subTest(url=url):
                payload = checkout_payload()
                payload["data"]["attributes"]["checkout_url"] = url
                self.post.return_value = provider_response(payload)
                with self.assertRaises(PayMongoCreationUnknown):
                    PayMongoService.create_checkout_session(**self.arguments)

    def test_resource_identity_and_mode_must_match(self):
        for path, value in (
            (("data", "id"), ""),
            (("data", "type"), "payment"),
            (("data", "attributes", "livemode"), True),
            (("data", "attributes", "livemode"), 0),
            (("data", "attributes", "checkout_url"), None),
            (("data", "attributes", "status"), []),
            (("data", "attributes", "reference_number"), "wrong-reference"),
            (("data", "attributes", "line_items"), [{"amount": 200}]),
            (("data", "attributes", "payment_method_types"), ["card"]),
            (("data", "attributes", "pass_on_fees"), True),
        ):
            with self.subTest(path=path):
                payload = checkout_payload()
                target = payload
                for field in path[:-1]:
                    target = target[field]
                target[path[-1]] = value
                self.post.return_value = provider_response(payload)
                with self.assertRaises(PayMongoCreationUnknown):
                    PayMongoService.create_checkout_session(**self.arguments)

    def test_full_response_with_optional_intent_is_normalized(self):
        PayMongoService.create_checkout_session(**self.arguments)
        attributes = copy.deepcopy(self.post.call_args.kwargs["json"]["data"]["attributes"])
        attributes.update(checkout_payload()["data"]["attributes"])
        attributes["status"] = "active"
        attributes["payment_intent"] = {
            "id": "pi_mock_intent",
            "attributes": {"status": "awaiting_payment_method"},
        }
        payload = checkout_payload()
        payload["data"]["attributes"] = attributes
        self.post.return_value = provider_response(payload)
        result = PayMongoService.create_checkout_session(**self.arguments)
        self.assertEqual(result.intent_id, "pi_mock_intent")
        self.assertEqual(result.intent_status, "awaiting_payment_method")
