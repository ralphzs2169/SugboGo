import json
from time import time_ns
from unittest.mock import patch

from django.db import DatabaseError
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.payments.models import Payment, PaymentProviderEvent
from apps.shared.services.maya_webhook_security import MAX_WEBHOOK_BYTES
from apps.shared.tests.test_maya_webhook_security import MayaSigningFixtures


class MayaWebhookTests(MayaSigningFixtures, APITestCase):
    payment_id = "b4012134-74e9-4cc4-8cfc-b8ae9fae7c85"

    def setUp(self):
        super().setUp()
        self.enterContext(self.settings(
            PAYMENT_PROVIDER="maya",
            PAYMENT_MODE="test",
            MAYA_WEBHOOK_ENABLED=True,
            MAYA_SANDBOX_WEBHOOK_VERIFICATION_KEYS=self.verification_keys,
        ))
        self.dispatch = self.enterContext(patch("apps.payments.tasks.dispatch_maya_event"))
        self.retrieve = self.enterContext(patch(
            "apps.shared.services.maya_checkout_service.MayaCheckoutService.retrieve_payment",
        ))
        self.url = reverse("maya-sandbox-webhook")

    def deliver(self, amount="1.00", status="PAYMENT_SUCCESS", timestamp=None, signed=True):
        payload = {
            "id": self.payment_id,
            "paymentStatus": status,
            "totalAmount": {"value": amount, "currency": "PHP"},
            "buyer": {"email": "fixture@example.com"},
        }
        entries = (
            f"buyer.email=fixture@example.com&id={self.payment_id}&paymentStatus={status}"
            f"&totalAmount.currency=PHP&totalAmount.value={amount}"
        )
        return self.client.post(
            self.url,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_MAYA_WEBHOOK_SIGNATURE=self.signature(entries) if signed else "invalid",
            HTTP_X_MAYA_WEBHOOK_TIMESTAMP=str(timestamp or (time_ns() // 1_000_000)),
        )

    def test_signed_delivery_is_durable_before_dispatch_and_retries_dedupe(self):
        now = time_ns() // 1_000_000
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.deliver(timestamp=now).status_code, 200)
            event = PaymentProviderEvent.objects.get()
            self.assertEqual(event.PWEV_STATE, "queued")
            self.assertNotIn("buyer", event.PWEV_DATA)
            self.dispatch.assert_not_called()
        self.dispatch.assert_called_once_with(event.pk)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.deliver(timestamp=now - 60000).status_code, 200)
        self.dispatch.assert_called_once()
        self.assertEqual(PaymentProviderEvent.objects.count(), 1)
        self.retrieve.assert_not_called()

    def test_conflicting_duplicate_keeps_original_evidence_and_records_review(self):
        self.assertEqual(self.deliver().status_code, 200)
        self.assertEqual(self.deliver(amount="2.00").status_code, 200)
        event = PaymentProviderEvent.objects.get()
        self.assertEqual(event.PWEV_DATA["amount_centavos"], 100)
        self.assertEqual(event.PWEV_STATE, "needs_attention")
        self.assertEqual(event.PWEV_LAST_ERROR, "conflicting_delivery")

    def test_unsupported_signed_event_is_durably_ignored(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.deliver(status="AUTHORIZED").status_code, 200)
        self.assertEqual(PaymentProviderEvent.objects.get().PWEV_STATE, "ignored")
        self.assertFalse(Payment.objects.exists())
        self.dispatch.assert_not_called()

    def test_database_failure_does_not_acknowledge_or_expose_details(self):
        with patch(
            "apps.payments.views.maya_webhook.accept_maya_delivery",
            side_effect=DatabaseError("private database detail"),
        ):
            response = self.deliver()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private database detail", str(response.data))
        self.dispatch.assert_not_called()

    def test_rejects_unsigned_non_json_oversized_disabled_and_non_post_requests(self):
        self.assertEqual(self.deliver(signed=False).status_code, 403)
        self.assertEqual(self.client.get(self.url).status_code, 405)
        self.assertEqual(self.client.post(self.url, "{}", content_type="text/plain").status_code, 415)
        response = self.client.post(
            self.url,
            " " * (MAX_WEBHOOK_BYTES + 1),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)
        with self.settings(MAYA_WEBHOOK_ENABLED=False):
            self.assertEqual(self.deliver().status_code, 404)
        self.assertFalse(PaymentProviderEvent.objects.exists())
