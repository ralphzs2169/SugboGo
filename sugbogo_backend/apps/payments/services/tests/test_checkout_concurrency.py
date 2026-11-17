from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import patch

import requests
from django.core.cache import cache
from django.db import connection, connections
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures
from apps.merchant_operations.merchant_analytics.views.tests.test_plus_checkout_views import (
    CHECKOUT_TEST_SETTINGS,
)
from apps.payments.models import Payment, PaymentCheckoutSession
from apps.payments.services.payment_service import PaymentService
from apps.shared.tests.test_maya_checkout_service import CHECKOUT_ID, CHECKOUT_URL, maya_response
from apps.users.models import User


@override_settings(**CHECKOUT_TEST_SETTINGS)
class CheckoutConcurrencyTests(MerchantAnalyticsFixtures, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.setUpTestData()
        cache.clear()

    def race(
        self,
        *,
        uncertain=False,
        retry_body=None,
    ):
        self.assertEqual(connection.vendor, "postgresql")
        barrier = Barrier(2)
        second_finished = Event()
        provider_started = Event()
        user_id = self.merchant_a.pk
        url = reverse("merchant-plus-checkout")

        def provider(
            *args,
            **kwargs,
        ):
            self.assertFalse(connection.in_atomic_block)
            self.assertTrue(PaymentCheckoutSession.objects.filter(PCHK_STATE="creating").exists())
            provider_started.set()
            if not second_finished.wait(timeout=20):
                raise AssertionError("Duplicate request waited behind provider I/O.")
            if uncertain:
                raise requests.ReadTimeout()
            return maya_response()

        def request_checkout(_):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=user_id))
                barrier.wait(timeout=20)
                response = client.post(url, retry_body or {}, format="json")
                if response.status_code == 202:
                    self.assertTrue(provider_started.wait(timeout=20))
                    second_finished.set()
                return response.status_code, response.data["data"]
            finally:
                connections.close_all()

        with patch(
            "apps.shared.services.maya_checkout_service.requests.post",
            side_effect=provider,
        ) as post:
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(request_checkout, range(2)))
            post.assert_called_once()
            client = APIClient()
            client.force_authenticate(self.merchant_a)
            resumed = client.post(url, retry_body or {}, format="json")
            post.assert_called_once()
        self.assertEqual(len({data["payment_id"] for _, data in results}), 1)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(PaymentCheckoutSession.objects.count(), 2 if retry_body else 1)
        self.assertEqual(Payment.objects.get().PYMT_STATUS, "pending")
        self.assertFalse(PaidMerchantPlusEntitlement.objects.exists())
        return results, resumed

    def test_concurrent_requests_commit_one_operation_and_one_provider_post(self):
        results, resumed = self.race()
        self.assertEqual(sorted(status for status, _ in results), [201, 202])
        self.assertEqual(resumed.status_code, 200)
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "ready")

    def test_concurrent_requests_cannot_recreate_uncertain_session(self):
        results, resumed = self.race(uncertain=True)
        self.assertEqual([status for status, _ in results], [202, 202])
        self.assertEqual(resumed.status_code, 202)
        self.assertEqual(PaymentCheckoutSession.objects.get().PCHK_STATE, "creation_unknown")

    def test_concurrent_terminal_retries_reserve_one_replacement(self):
        payment, _ = PaymentService.create_or_get_payment(self.merchant_a)
        old_checkout = PaymentCheckoutSession.objects.create(
            PYMT_ID=payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_STATE="ready",
            PCHK_PROVIDER_STATUS="PAYMENT_CANCELLED",
            PCHK_PROVIDER_SESSION_ID="87654321-4321-4321-8321-876543218765",
            PCHK_CHECKOUT_URL=f"{CHECKOUT_URL}&previous=1",
        )
        results, resumed = self.race(retry_body={
            "retry_checkout_reference": str(old_checkout.PCHK_OPERATION_REFERENCE),
        })
        self.assertEqual(sorted(status for status, _ in results), [201, 202])
        self.assertEqual(resumed.status_code, 200)
        self.assertEqual(resumed.data["data"]["checkout_session_id"], CHECKOUT_ID)
        old_checkout.refresh_from_db()
        self.assertEqual(old_checkout.PCHK_STATE, "superseded")
        self.assertEqual(old_checkout.PCHK_PROVIDER_STATUS, "PAYMENT_CANCELLED")
