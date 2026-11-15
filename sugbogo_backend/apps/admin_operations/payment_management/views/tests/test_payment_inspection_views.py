"""Protect read-only Admin payment visibility, privacy, and bounded query loading."""

from datetime import datetime, timedelta, timezone as datetime_timezone
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures
from apps.payments.models import Payment, PaymentCheckoutSession, PaymentProviderEvent
from apps.users.models import User

from ...serializers.payment_inspection_serializers import PaymentInspectionDetailSerializer
from ...services.payment_inspection_service import PaymentInspectionService


@override_settings(PAYMENT_MODE="test", PAYMENT_PROVIDER="maya")
class PaymentInspectionViewTests(MerchantAnalyticsFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.user("payment-admin", User.UserRole.ADMIN)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.now = timezone.now()
        self.payment = self.create_payment(self.merchant_a, self.business_a)
        self.legacy = self.create_payment(
            self.merchant_b,
            self.business_b,
            PYMT_PROVIDER="paymongo",
            PYMT_MODE="live",
            PYMT_STATUS="paid",
            PYMT_FULFILMENT_STATUS="fulfilled",
            PYMT_FULFILLED_AT=self.now,
            PYMT_PAID_AT=self.now,
            PYMT_VERIFIED_AT=self.now,
            PYMT_PROVIDER_PAYMENT_ID="legacy-payment-id",
            PYMT_PROVIDER_INTENT_ID="legacy-intent-id",
        )
        self.checkout = PaymentCheckoutSession.objects.create(
            PYMT_ID=self.payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_STATE="ready",
            PCHK_PROVIDER_SESSION_ID="sandbox-checkout-id",
            PCHK_CHECKOUT_URL="https://payments-web-sandbox.paymaya.com/TOKEN-DO-NOT-EXPOSE",
            PCHK_PROVIDER_STATUS="PENDING_PAYMENT",
        )
        self.list_url = reverse("admin-payment-list")
        self.summary_url = reverse("admin-payment-summary")
        self.detail_url = reverse("admin-payment-detail", args=[self.payment.pk])
        self.urls = (self.list_url, self.summary_url, self.detail_url)

    def create_payment(
        self,
        user,
        business,
        **overrides,
    ):
        values = {
            "USER_ID": user,
            "BUSN_ID": business,
            "PYMT_PRODUCT": "merchant_plus",
            "PYMT_PRODUCT_VERSION": "capstone-v1",
            "PYMT_AMOUNT_CENTAVOS": 100,
            "PYMT_CURRENCY": "PHP",
            "PYMT_ACCESS_DURATION_DAYS": 30,
            "PYMT_PROVIDER": "maya",
            "PYMT_MODE": "test",
        }
        values.update(overrides)
        return Payment.objects.create(**values)

    def event(
        self,
        **overrides,
    ):
        values = {
            "PWEV_PROVIDER": "maya",
            "PWEV_MODE": "test",
            "PWEV_DEDUPE_KEY": f"event-{PaymentProviderEvent.objects.count()}",
            "PWEV_TYPE": "PAYMENT_SUCCESS",
            "PWEV_STATE": "needs_attention",
            "PWEV_PROVIDER_CHECKOUT_ID": "sandbox-checkout-id",
            "PWEV_PAYLOAD_DIGEST": "a" * 64,
            "PWEV_DATA": {"request_reference": "PAYLOAD-DO-NOT-EXPOSE"},
        }
        values.update(overrides)
        return PaymentProviderEvent.objects.create(**values)

    def ids(
        self,
        params=None,
    ):
        response = self.client.get(self.list_url, params or {})
        self.assertEqual(response.status_code, 200, response.data)
        return [
            row["id"]
            for row in response.data["data"]["items"]
        ]

    def test_admin_and_super_admin_allowed(self):
        for role in ("admin", "super_admin"):
            self.admin.USER_ROLE = role
            for url in self.urls:
                with self.subTest(role=role, url=url):
                    self.assertEqual(self.client.get(url).status_code, 200)

    def test_unauthenticated_and_non_admin_denied(self):
        self.client.force_authenticate(None)
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 401)
        for role in ("merchant", "explorer"):
            self.merchant_a.USER_ROLE = role
            self.client.force_authenticate(self.merchant_a)
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_inactive_admin_denied(self):
        self.admin.USER_STATUS = User.UserStatus.SUSPENDED
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_no_mutation_methods_or_provider_calls(self):
        models = (
            Payment,
            PaymentCheckoutSession,
            PaymentProviderEvent,
            PaidMerchantPlusEntitlement,
        )
        before = [
            list(model.objects.order_by("pk").values())
            for model in models
        ]
        with patch(
            "requests.sessions.Session.request",
            side_effect=AssertionError("No provider HTTP"),
        ):
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 200)
                for method in ("post", "patch", "put", "delete"):
                    response = getattr(self.client, method)(url, {}, format="json")
                    self.assertEqual(response.status_code, 405)
        after = [
            list(model.objects.order_by("pk").values())
            for model in models
        ]
        self.assertEqual(before, after)

    def test_list_contract_and_cross_mode_history(self):
        response = self.client.get(self.list_url)
        rows = response.data["data"]["items"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]["amount_centavos"], 100)
        self.assertEqual(rows[1]["currency"], "PHP")
        self.assertEqual(rows[1]["provider"], "maya")
        self.assertEqual(rows[1]["mode"], "test")
        self.assertEqual(rows[0]["provider"], "paymongo")
        self.assertEqual(rows[0]["mode"], "live")
        self.assertEqual(rows[0]["financial_status"], "paid")
        self.assertIsNone(rows[0]["checkout_outcome"])

    def test_global_summary_uses_distinct_stored_review_evidence(self):
        self.event()
        self.event()
        response = self.client.get(self.summary_url, {"mode": "live", "page_size": 1})
        self.assertEqual(response.data["data"], {
            "total_payments": 2,
            "pending": 1,
            "paid": 1,
            "needs_review": 1,
        })
        self.assertEqual(self.ids({"needs_review": "true"}), [self.payment.pk])
        self.assertEqual(self.ids({"needs_review": "false"}), [self.legacy.pk])

    def test_uncertain_checkout_and_fulfilment_attention_count_as_review(self):
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_STATE="creation_unknown",
        )
        Payment.objects.filter(pk=self.legacy.pk).update(PYMT_FULFILMENT_STATUS="needs_attention")
        response = self.client.get(self.summary_url)
        self.assertEqual(response.data["data"]["needs_review"], 2)

    def test_search_reference_name_email_business_and_provider_payment_id(self):
        for value in (
            str(self.legacy.PYMT_REFERENCE),
            "Analytics merchant-b",
            self.merchant_b.USER_EMAIL,
            self.business_b.BUSN_NAME,
            "legacy-payment-id",
        ):
            with self.subTest(search=value):
                self.assertEqual(self.ids({"search": value}), [self.legacy.pk])

    def test_financial_fulfilment_provider_and_mode_filters(self):
        filters = (
            {"financial_status": "paid"},
            {"fulfilment_status": "fulfilled"},
            {"provider": "paymongo"},
            {"mode": "live"},
        )
        for params in filters:
            with self.subTest(params=params):
                self.assertEqual(self.ids(params), [self.legacy.pk])

    def test_checkout_outcome_matches_existing_status_contract(self):
        for provider_status, state, expected in (
            ("PENDING_PAYMENT", "ready", "pending"),
            ("PAYMENT_CANCELLED", "ready", "cancelled"),
            ("PAYMENT_FAILED", "ready", "failed"),
            ("PAYMENT_EXPIRED", "expired", "expired"),
            ("", "creation_unknown", "unknown"),
        ):
            with self.subTest(expected=expected):
                PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
                    PCHK_PROVIDER_STATUS=provider_status,
                    PCHK_STATE=state,
                )
                self.assertEqual(self.ids({"checkout_outcome": expected}), [self.payment.pk])
                detail = self.client.get(self.detail_url).data["data"]
                self.assertEqual(detail["checkout_outcome"], expected)
                self.assertEqual(detail["checkouts"][0]["outcome"], expected)

    def test_paid_is_authoritative_over_old_cancelled_checkout(self):
        Payment.objects.filter(pk=self.payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_PROVIDER_PAYMENT_ID="sandbox-checkout-id",
            PYMT_PAID_AT=self.now,
            PYMT_VERIFIED_AT=self.now,
            PYMT_FULFILMENT_STATUS="pending",
        )
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_STATUS="PAYMENT_CANCELLED",
        )
        detail = self.client.get(self.detail_url).data["data"]
        self.assertEqual(detail["financial_status"], "paid")
        self.assertIsNone(detail["checkout_outcome"])
        self.assertIsNone(detail["checkouts"][0]["outcome"])
        self.assertIsNone(detail["entitlement"])
        self.assertEqual(detail["verification"]["amount_centavos"], 100)
        self.assertNotIn(self.payment.pk, self.ids({"checkout_outcome": "cancelled"}))

    def test_philippine_inclusive_creation_date_range(self):
        anchor = datetime(2026, 11, 15, 16, tzinfo=datetime_timezone.utc)
        Payment.objects.filter(pk=self.payment.pk).update(PYMT_CREATED_AT=anchor)
        Payment.objects.filter(pk=self.legacy.pk).update(
            PYMT_CREATED_AT=anchor - timedelta(microseconds=1),
        )
        self.assertEqual(
            self.ids({"start_date": "2026-11-16", "end_date": "2026-11-16"}),
            [self.payment.pk],
        )
        self.assertEqual(self.ids({"end_date": "2026-11-15"}), [self.legacy.pk])

    def test_ordering_and_standard_pagination(self):
        self.assertEqual(self.ids({"ordering": "oldest"}), [self.payment.pk, self.legacy.pk])
        self.assertEqual(self.ids({"ordering": "amount_lowest"}), [self.payment.pk, self.legacy.pk])
        for ordering in ("newest", "amount_highest"):
            self.assertEqual(self.ids({"ordering": ordering}), [self.legacy.pk, self.payment.pk])
        response = self.client.get(self.list_url, {"page": 2, "page_size": 1})
        self.assertEqual(response.data["data"]["items"][0]["id"], self.payment.pk)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 2)
        self.assertEqual(response.data["data"]["pagination"]["total_pages"], 2)

    def test_invalid_filters_dates_and_missing_detail(self):
        for params in (
            {"provider": "unknown"},
            {"mode": "sandbox"},
            {"financial_status": "failed"},
            {"checkout_outcome": "success"},
            {"needs_review": "maybe"},
            {"ordering": "PYMT_ID"},
            {"start_date": "not-a-date"},
            {"end_date": "9999-12-31"},
            {"start_date": "2026-11-16", "end_date": "2026-11-15"},
        ):
            self.assertEqual(self.client.get(self.list_url, params).status_code, 400)
        self.assertEqual(
            self.client.get(reverse("admin-payment-detail", args=[999999])).status_code,
            404,
        )

    def test_detail_entitlement_is_historical_provider_and_mode_scoped(self):
        PaidMerchantPlusEntitlement.objects.create(
            PYMT_ID=self.legacy,
            BUSN_ID=self.business_b,
            MPPE_STARTS_AT=self.now - timedelta(minutes=1),
            MPPE_EXPIRES_AT=self.now + timedelta(days=30),
        )
        detail = self.client.get(
            reverse("admin-payment-detail", args=[self.legacy.pk]),
        ).data["data"]
        self.assertEqual(detail["entitlement"]["access_source"], "paymongo_live")
        self.assertTrue(detail["entitlement"]["active_in_stored_mode"])
        self.assertEqual(detail["checkouts"], [])

    def test_event_history_includes_unlinked_conflicts_but_not_other_environment(self):
        first = self.event(PWEV_LAST_ERROR="conflicting_delivery")
        second = self.event(PYMT_ID=self.payment, PCHK_ID=self.checkout)
        self.event(PWEV_MODE="live")
        detail = self.client.get(self.detail_url).data["data"]
        self.assertEqual([event["id"] for event in detail["events"]], [first.pk, second.pk])
        self.assertTrue(detail["events"][0]["needs_review"])
        self.assertTrue(detail["events"][0]["has_conflict"])
        self.assertFalse(detail["events"][1]["has_conflict"])
        self.assertTrue(detail["needs_review"])

    def test_sensitive_provider_fields_never_leave_the_projection(self):
        self.event()
        for url in self.urls:
            response = self.client.get(url)
            body = response.content.decode()
            for secret in (
                "TOKEN-DO-NOT-EXPOSE", "PAYLOAD-DO-NOT-EXPOSE", "PWEV_DATA",
                "checkout_url", "payload_digest", "dedupe_key", "authorization",
                "signature", "card_last4", "legacy-intent-id",
            ):
                self.assertNotIn(secret, body)

    def test_detail_query_count_is_independent_of_operation_and_event_history(self):
        for _ in range(5):
            self.event()
        with self.assertNumQueries(3):
            payment = PaymentInspectionService.get_payment(self.payment.pk)
            data = PaymentInspectionDetailSerializer(payment).data
            self.assertEqual(len(data["events"]), 5)
        with self.assertNumQueries(2):
            self.assertEqual(self.client.get(self.list_url).status_code, 200)

    def test_verification_reference_requires_a_matching_completed_checkout(self):
        Payment.objects.filter(pk=self.payment.pk).update(
            PYMT_STATUS="paid",
            PYMT_PROVIDER_PAYMENT_ID="sandbox-checkout-id",
            PYMT_PAID_AT=self.now,
            PYMT_VERIFIED_AT=self.now,
            PYMT_FULFILMENT_STATUS="pending",
        )
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(PCHK_STATE="completed")
        detail = self.client.get(self.detail_url).data["data"]
        self.assertEqual(
            detail["verification"]["request_reference"],
            self.checkout.PCHK_OPERATION_REFERENCE,
        )
        PaymentCheckoutSession.objects.filter(pk=self.checkout.pk).update(
            PCHK_PROVIDER_SESSION_ID="other-completed-checkout",
        )
        detail = self.client.get(self.detail_url).data["data"]
        self.assertIsNone(detail["verification"]["request_reference"])

    def test_unlinked_event_on_an_older_operation_is_included_in_review_count(self):
        self.event(PWEV_LAST_ERROR="conflicting_delivery")
        PaymentCheckoutSession.objects.create(
            PYMT_ID=self.payment,
            PCHK_PROVIDER="maya",
            PCHK_MODE="test",
            PCHK_STATE="creation_failed",
        )
        self.assertEqual(self.ids({"needs_review": "true"}), [self.payment.pk])
        detail = self.client.get(self.detail_url).data["data"]
        self.assertEqual(len(detail["checkouts"]), 2)
        self.assertEqual(len(detail["events"]), 1)

    def test_other_products_are_not_part_of_this_inspection_surface(self):
        Payment.objects.filter(pk=self.payment.pk).update(PYMT_PRODUCT="unsupported")
        self.assertEqual(self.ids(), [self.legacy.pk])
        self.assertEqual(self.client.get(self.detail_url).status_code, 404)
