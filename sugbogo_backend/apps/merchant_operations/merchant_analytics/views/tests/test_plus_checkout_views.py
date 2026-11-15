import json
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import requests
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.business.models import Business
from apps.payments.models import Payment, PaymentCheckoutSession, PaymentProviderEvent
from apps.payments.services.payment_service import PaymentService
from apps.shared.tests.test_maya_checkout_service import CHECKOUT_ID, CHECKOUT_URL, maya_response
from apps.users.models import User

from ...models import PaidMerchantPlusEntitlement
from ...services.tests.fixtures import MerchantAnalyticsFixtures


CHECKOUT_TEST_SETTINGS = {
    "PAYMENT_MODE": "test",
    "PAYMENT_PROVIDER": "maya",
    "MAYA_CHECKOUT_ENABLED": True,
    "MAYA_SANDBOX_PUBLIC_KEY": "pk-checkout-fixture-only",
    "MAYA_SANDBOX_SECRET_KEY": "sk-checkout-fixture-only",
    "MAYA_RETURN_BASE_URL": "https://sugbogo.example/payment-return",
    "MERCHANT_PLUS_ENFORCED": True,
    "MERCHANT_PLUS_MOCK_ENABLED": False,
    "CACHES": {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
}


@override_settings(**CHECKOUT_TEST_SETTINGS)
class MerchantPlusCheckoutViewTests(MerchantAnalyticsFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.url = reverse("merchant-plus-checkout")
        self.client.force_authenticate(self.merchant_a)
        patcher = patch("apps.shared.services.maya_checkout_service.requests.post")
        self.post = patcher.start()
        self.addCleanup(patcher.stop)
        self.post.return_value = maya_response()

    def checkout(self):
        return self.client.post(self.url, {}, format="json")

    def grant_paid(self):
        now = timezone.now()
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        Payment.objects.filter(pk=payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_FULFILMENT_STATUS="fulfilled",
            PYMT_PROVIDER_PAYMENT_ID="pay_existing",
            PYMT_PAID_AT=now,
            PYMT_VERIFIED_AT=now,
            PYMT_FULFILLED_AT=now,
        )
        PaidMerchantPlusEntitlement.objects.create(
            BUSN_ID=self.business_a,
            PYMT_ID=payment,
            MPPE_STARTS_AT=now,
            MPPE_EXPIRES_AT=now + timedelta(days=30),
        )
        return payment

    def test_unauthenticated_request_is_rejected(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.checkout().status_code, 401)
        self.post.assert_not_called()
        self.assertFalse(Payment.objects.exists())

    def test_non_merchant_is_rejected(self):
        for role in (User.UserRole.EXPLORER, User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            with self.subTest(role=role):
                user = self.user(f"checkout-{role}", role)
                self.client.force_authenticate(user)
                self.assertEqual(self.checkout().status_code, 403)
        self.post.assert_not_called()

    def test_inactive_merchant_is_rejected(self):
        self.merchant_a.USER_STATUS = User.UserStatus.SUSPENDED
        self.merchant_a.save(update_fields=["USER_STATUS"])
        self.assertEqual(self.checkout().status_code, 403)
        self.post.assert_not_called()

    def test_merchant_without_business_is_rejected(self):
        self.client.force_authenticate(self.user("no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.checkout().status_code, 404)
        self.post.assert_not_called()

    def test_all_client_overrides_are_rejected(self):
        for field in (
            "amount", "currency", "product", "business_id", "user_id", "mode",
            "provider", "return_url", "redirect_url", "paid", "payment_status",
            "fulfilment_status", "entitlement", "price", "access_duration", "product_version",
        ):
            with self.subTest(field=field):
                cache.clear()
                response = self.client.post(self.url, {field: "override"}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data["errors"])
        self.post.assert_not_called()
        self.assertFalse(Payment.objects.exists())

    def test_empty_object_and_json_content_are_required(self):
        for body in ([], None, "", "override"):
            with self.subTest(body=body):
                response = self.client.generic(
                    "POST",
                    self.url,
                    data=json.dumps(body),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
        response = self.client.generic("POST", self.url, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(self.url, {"amount": 1}, format="multipart")
        self.assertEqual(response.status_code, 415)
        self.post.assert_not_called()

    def test_query_overrides_are_rejected(self):
        response = self.client.post(f"{self.url}?mode=live", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.post.assert_not_called()

    def test_checkout_disabled_and_preview_mock_configuration_block_creation(self):
        for configuration in (
            {"MAYA_CHECKOUT_ENABLED": False},
            {"MERCHANT_PLUS_ENFORCED": False},
            {"MERCHANT_PLUS_MOCK_ENABLED": True},
        ):
            with self.subTest(configuration=configuration):
                with override_settings(**configuration):
                    self.assertEqual(self.checkout().status_code, 403)
        self.post.assert_not_called()
        self.assertFalse(Payment.objects.exists())

    def test_success_persists_one_pending_fixed_price_purchase(self):
        response = self.checkout()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["success"])
        payment = Payment.objects.get()
        operation = PaymentCheckoutSession.objects.get()
        self.assertEqual(payment.USER_ID, self.merchant_a)
        self.assertEqual(payment.BUSN_ID, self.business_a)
        self.assertEqual(payment.PYMT_AMOUNT_CENTAVOS, 100)
        self.assertEqual(payment.PYMT_CURRENCY, "PHP")
        self.assertEqual(payment.PYMT_PRODUCT, "merchant_plus")
        self.assertEqual(payment.PYMT_PRODUCT_VERSION, "capstone-v1")
        self.assertEqual(payment.PYMT_ACCESS_DURATION_DAYS, 30)
        self.assertEqual(payment.PYMT_MODE, "test")
        self.assertEqual(payment.PYMT_PROVIDER, "maya")
        self.assertEqual(response.data["data"]["provider"], "maya")
        self.assertEqual(payment.PYMT_STATUS, "pending")
        self.assertEqual(payment.PYMT_FULFILMENT_STATUS, "not_started")
        self.assertIsNone(payment.PYMT_PROVIDER_PAYMENT_ID)
        self.assertIsNone(payment.PYMT_PAID_AT)
        self.assertEqual(operation.PCHK_STATE, "ready")
        self.assertEqual(operation.PCHK_MODE, "test")
        self.assertEqual(operation.PCHK_PROVIDER_SESSION_ID, CHECKOUT_ID)
        self.assertEqual(operation.PCHK_PROVIDER, "maya")
        self.assertEqual(operation.PCHK_CHECKOUT_URL, CHECKOUT_URL)
        self.assertEqual(operation.PCHK_CHECKOUT_URL, response.data["data"]["checkout_url"])
        self.assertIsNone(payment.PYMT_PROVIDER_INTENT_ID)
        self.assertIsNone(operation.PCHK_INTENT_ID)
        self.assertIsNone(operation.PCHK_INTENT_STATUS)
        self.assertEqual(operation.PCHK_PROVIDER_STATUS, "")
        self.assertIsNone(operation.PCHK_LEASE_UNTIL)
        self.assertIsNotNone(operation.PCHK_CHECKED_AT)
        self.assertEqual(response.data["data"]["next_action"], "open_checkout")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
        self.assertFalse(PaymentProviderEvent.objects.exists())
        self.post.assert_called_once()
        self.assertNotIn("pk-checkout-fixture-only", str(response.data))
        self.assertNotIn("sk-checkout-fixture-only", str(response.data))

    def test_provider_receives_server_generated_return_hints(self):
        self.checkout()
        payment = Payment.objects.get()
        operation = PaymentCheckoutSession.objects.get()
        payload = json.loads(self.post.call_args.kwargs["data"])
        self.assertEqual(payload["requestReferenceNumber"], str(operation.PCHK_OPERATION_REFERENCE))
        for outcome in ("success", "failure", "cancel"):
            parsed = urlsplit(payload["redirectUrl"][outcome])
            self.assertEqual(parsed.scheme, "https")
            self.assertEqual(parsed.netloc, "sugbogo.example")
            self.assertEqual(parsed.path, "/payment-return")
            self.assertEqual(parse_qs(parsed.query), {
                "payment_reference": [str(payment.PYMT_REFERENCE)],
                "operation_reference": [str(operation.PCHK_OPERATION_REFERENCE)],
                "outcome": [outcome],
            })

    def test_sequential_duplicate_reuses_exact_session_and_payment(self):
        first = self.checkout()
        second = self.checkout()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["data"], second.data["data"])
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(PaymentCheckoutSession.objects.count(), 1)
        self.post.assert_called_once()

    def test_ready_session_is_reused_despite_elapsed_local_lease(self):
        self.checkout()
        PaymentCheckoutSession.objects.update(
            PCHK_LEASE_UNTIL=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(self.checkout().status_code, 200)
        self.post.assert_called_once()

    def test_stale_ready_session_waits_without_opening_or_creating_another(self):
        self.assertEqual(self.checkout().status_code, 201)
        PaymentCheckoutSession.objects.update(
            PCHK_CREATED_AT=timezone.now() - timedelta(hours=1),
        )
        second = self.checkout()
        self.assertEqual(second.status_code, 202)
        self.assertEqual(second.data["data"]["next_action"], "wait")
        self.assertIsNone(second.data["data"]["checkout_url"])
        self.assertIsNone(second.data["data"]["checkout_session_id"])
        self.assertIsNone(second.data["data"]["status_check_after_seconds"])
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "ready")
        self.assertEqual(Payment.objects.get().PYMT_STATUS, "pending")
        self.post.assert_called_once()

    def test_reported_in_progress_status_is_preserved_and_does_not_expose_a_url(self):
        self.post.return_value = maya_response({
            "checkoutId": CHECKOUT_ID,
            "redirectUrl": CHECKOUT_URL,
            "paymentStatus": "PENDING_PAYMENT",
        })
        for _ in range(2):
            response = self.checkout()
            self.assertEqual(response.status_code, 202)
            self.assertIsNone(response.data["data"]["checkout_url"])
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_PROVIDER_STATUS, "PENDING_PAYMENT")
        self.assertEqual(Payment.objects.get().PYMT_STATUS, "pending")
        self.post.assert_called_once()

    def test_network_uncertainty_is_preserved_and_not_retried(self):
        self.post.side_effect = requests.ReadTimeout()
        self.assertEqual(self.checkout().status_code, 202)
        operation = PaymentCheckoutSession.objects.get()
        self.assertEqual(operation.PCHK_STATE, "creation_unknown")
        self.assertEqual(operation.PCHK_LAST_ERROR, "provider_connection_interrupted")
        self.assertIsNone(operation.PCHK_PROVIDER_SESSION_ID)
        self.assertEqual(operation.PCHK_CHECKOUT_URL, "")
        reference = operation.PCHK_OPERATION_REFERENCE
        self.post.reset_mock()
        second = self.checkout()
        self.assertEqual(second.status_code, 202)
        self.assertEqual(second.data["data"]["next_action"], "wait")
        self.assertEqual(second.data["data"]["status_check_after_seconds"], 5)
        self.assertIsNone(second.data["data"]["checkout_url"])
        self.post.assert_not_called()
        operation.refresh_from_db()
        self.assertEqual(operation.PCHK_OPERATION_REFERENCE, reference)
        self.assertEqual(Payment.objects.get().PYMT_STATUS, "pending")

    def test_connection_interruption_is_unknown(self):
        self.post.side_effect = requests.ConnectionError()
        self.assertEqual(self.checkout().status_code, 202)
        self.assertEqual(self.checkout().status_code, 202)
        self.post.assert_called_once()
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "creation_unknown")

    def test_malformed_success_is_unknown_and_not_retried(self):
        self.post.return_value = maya_response({"checkoutId": CHECKOUT_ID})
        self.assertEqual(self.checkout().status_code, 202)
        self.assertEqual(self.checkout().status_code, 202)
        self.post.assert_called_once()
        operation = PaymentCheckoutSession.objects.get()
        self.assertEqual(operation.PCHK_STATE, "creation_unknown")
        self.assertEqual(operation.PCHK_LAST_ERROR, "provider_checkout_url_invalid")

    def test_uncertain_server_error_is_not_definite_rejection(self):
        self.post.return_value = maya_response({}, status_code=500)
        self.assertEqual(self.checkout().status_code, 202)
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "creation_unknown")

    def test_in_progress_and_expired_lease_never_create_again(self):
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        operation = PaymentCheckoutSession.objects.create(
            PYMT_ID=payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_LEASE_UNTIL=timezone.now() + timedelta(minutes=1),
        )
        self.assertEqual(self.checkout().status_code, 202)
        operation.PCHK_LEASE_UNTIL = timezone.now() - timedelta(seconds=1)
        operation.save()
        response = self.checkout()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["data"]["checkout_status"], "creation_unknown")
        self.post.assert_not_called()
        self.assertEqual(PaymentCheckoutSession.objects.count(), 1)

    def test_definite_rejection_can_be_explicitly_retried_with_same_payment(self):
        self.post.return_value = maya_response(
            {"code": "2553", "message": "private-provider-detail"},
            status_code=400,
        )
        response = self.checkout()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private-provider-detail", str(response.data))
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "creation_failed")
        payment = Payment.objects.get()
        self.post.return_value = maya_response()
        self.assertEqual(self.checkout().status_code, 201)
        self.assertEqual(Payment.objects.get().pk, payment.pk)
        self.assertEqual(PaymentCheckoutSession.objects.count(), 2)
        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(payment.PYMT_STATUS, "pending")

    def test_missing_credentials_fail_safely_without_http(self):
        with override_settings(MAYA_SANDBOX_PUBLIC_KEY=""):
            response = self.checkout()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "creation_failed")
        self.post.assert_not_called()

    def test_active_paid_access_blocks_another_purchase(self):
        self.grant_paid()
        self.assertEqual(self.checkout().status_code, 409)
        self.post.assert_not_called()
        self.assertEqual(Payment.objects.count(), 1)

    def test_paid_unfulfilled_or_missing_entitlement_requires_review(self):
        payment = self.grant_paid()
        PaidMerchantPlusEntitlement.objects.all().delete()
        self.assertEqual(self.checkout().status_code, 409)
        Payment.objects.filter(pk=payment.pk).update(PYMT_FULFILMENT_STATUS="pending")
        self.assertEqual(self.checkout().status_code, 409)
        self.post.assert_not_called()

    def test_completed_or_expired_session_is_not_blindly_replaced(self):
        self.checkout()
        for state in ("expired", "completed"):
            with self.subTest(state=state):
                PaymentCheckoutSession.objects.update(PCHK_STATE=state)
                self.assertEqual(self.checkout().status_code, 409)
        self.post.assert_called_once()

    def test_status_recovers_references_and_states_without_checkout_url(self):
        created = self.checkout().data["data"]
        self.client.force_authenticate(None)
        self.client.force_authenticate(self.merchant_a)
        status = self.client.get(reverse("merchant-plus-status")).data["data"]
        self.assertEqual(status["unresolved_payment_id"], created["payment_id"])
        self.assertEqual(status["unresolved_payment_reference"], created["payment_reference"])
        self.assertTrue(status["checkout_enabled"])
        self.assertEqual(status["unresolved_payment_provider"], "maya")
        self.assertEqual(status["unresolved_payment_mode"], "test")
        self.assertEqual(status["unresolved_payment_status"], "pending")
        self.assertEqual(status["unresolved_fulfilment_status"], "not_started")
        self.assertEqual(status["unresolved_checkout_status"], "ready")
        self.assertNotIn("checkout_url", status)
        self.client.force_authenticate(self.merchant_b)
        status = self.client.get(reverse("merchant-plus-status")).data["data"]
        self.assertIsNone(status["unresolved_payment_id"])
        self.assertIsNone(status["unresolved_checkout_status"])
        self.post.return_value = maya_response({
            "checkoutId": "87654321-4321-4321-8321-876543218765",
            "redirectUrl": CHECKOUT_URL,
        })
        self.assertEqual(self.checkout().status_code, 201)
        self.assertEqual(Payment.objects.count(), 2)
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())

    def test_maya_live_and_legacy_checkout_are_disabled(self):
        for configuration in (
            {"PAYMENT_MODE": "live"},
            {"PAYMENT_PROVIDER": "paymongo", "PAYMONGO_CHECKOUT_ENABLED": True},
        ):
            with self.subTest(configuration=configuration):
                with override_settings(**configuration):
                    self.assertEqual(self.checkout().status_code, 403)
        self.assertFalse(Payment.objects.exists())
        self.post.assert_not_called()

    def test_legacy_unresolved_payment_remains_readable_and_blocks_maya_checkout(self):
        with override_settings(PAYMENT_PROVIDER="paymongo"):
            legacy, _ = PaymentService.create_or_get_payment(self.merchant_a)
        self.assertEqual(self.checkout().status_code, 409)
        status = self.client.get(reverse("merchant-plus-status")).data["data"]
        self.assertEqual(status["unresolved_payment_provider"], "paymongo")
        self.assertEqual(status["unresolved_payment_reference"], str(legacy.PYMT_REFERENCE))
        legacy.refresh_from_db()
        self.assertEqual(legacy.PYMT_PROVIDER, "paymongo")
        self.assertEqual(Payment.objects.count(), 1)
        self.assertFalse(PaymentCheckoutSession.objects.exists())
        self.post.assert_not_called()

    def test_mode_switch_during_http_does_not_reinterpret_reserved_payment(self):
        def change_mode(
            *args,
            **kwargs,
        ):
            configuration = override_settings(PAYMENT_MODE="live")
            configuration.enable()
            self.addCleanup(configuration.disable)
            self.assertEqual(Payment.objects.get().PYMT_MODE, "test")
            return maya_response()

        self.post.side_effect = change_mode
        self.assertEqual(self.checkout().status_code, 201)
        self.assertEqual(self.post.call_args.kwargs["auth"].username, "pk-checkout-fixture-only")
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_MODE, "test")

    def test_production_host_echo_is_unknown(self):
        self.post.return_value = maya_response({
            "checkoutId": CHECKOUT_ID,
            "redirectUrl": "https://payments.maya.ph/v2/checkout",
        })
        self.assertEqual(self.checkout().status_code, 202)
        self.assertEqual(self.checkout().status_code, 202)
        self.post.assert_called_once()

    def test_ownership_change_during_http_retains_session_but_withholds_url(self):
        def change_owner(
            *args,
            **kwargs,
        ):
            Business.objects.filter(pk=self.business_a.pk).update(USER_ID=self.supporter_a)
            return maya_response()

        self.post.side_effect = change_owner
        self.assertEqual(self.checkout().status_code, 409)
        operation = PaymentCheckoutSession.objects.get()
        self.assertEqual(operation.PCHK_STATE, "creation_unknown")
        self.assertEqual(operation.PCHK_PROVIDER_SESSION_ID, CHECKOUT_ID)
        self.assertEqual(operation.PCHK_LAST_ERROR, "ownership_requires_review")
        self.assertEqual(Payment.objects.get().PYMT_STATUS, "pending")

    def test_new_owner_cannot_create_over_previous_owners_unresolved_purchase(self):
        PaymentService.create_or_get_payment(self.merchant_a)
        new_owner = self.user("new-checkout-owner", User.UserRole.MERCHANT)
        Business.objects.filter(pk=self.business_a.pk).update(USER_ID=new_owner)
        self.client.force_authenticate(new_owner)
        self.assertEqual(self.checkout().status_code, 409)
        self.assertEqual(Payment.objects.count(), 1)
        self.post.assert_not_called()

    def test_unexpected_historical_product_snapshot_requires_review(self):
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        Payment.objects.filter(pk=payment.pk).update(PYMT_AMOUNT_CENTAVOS=200)
        self.assertEqual(self.checkout().status_code, 409)
        self.post.assert_not_called()

    def test_provider_identity_collision_blocks_another_provider_attempt(self):
        self.assertEqual(self.checkout().status_code, 201)
        self.client.force_authenticate(self.merchant_b)
        self.assertEqual(self.checkout().status_code, 409)
        self.assertEqual(self.checkout().status_code, 409)
        self.assertEqual(self.post.call_count, 2)
        other = PaymentCheckoutSession.objects.get(PYMT_ID__USER_ID=self.merchant_b)
        self.assertEqual(other.PCHK_STATE, "creation_unknown")
        self.assertEqual(other.PCHK_LAST_ERROR, "provider_identity_conflict")
        self.assertIsNone(other.PCHK_PROVIDER_SESSION_ID)

    def test_checkout_throttle_limits_repeated_requests(self):
        self.checkout()
        for _ in range(9):
            self.assertEqual(self.checkout().status_code, 200)
        self.assertEqual(self.checkout().status_code, 429)
        self.post.assert_called_once()
