import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, connection, connections, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.merchant_operations.merchant_analytics.entitlements import merchant_has_plus_access
from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures
from apps.payments.models import Payment, PaymentCheckoutSession, PayMongoWebhookEvent
from apps.payments.services.payment_service import PaymentService
from apps.users.models import User


@override_settings(
    PAYMONGO_MODE="test",
    PAYMONGO_CHECKOUT_ENABLED=False,
    MERCHANT_PLUS_ENFORCED=True,
    MERCHANT_PLUS_MOCK_ENABLED=False,
)
class PaymentFoundationTests(MerchantAnalyticsFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.payment, self.created = PaymentService.create_or_get_payment(self.merchant_a)

    def mark_paid(
        self,
        *,
        fulfilled=True,
        payment=None,
    ):
        payment = payment or self.payment
        fulfilment = Payment.FulfilmentStatus.PENDING
        fulfilled_at = None
        if fulfilled:
            fulfilment = Payment.FulfilmentStatus.FULFILLED
            fulfilled_at = self.now
        Payment.objects.filter(pk=payment.pk).update(
            PYMT_STATUS=Payment.Status.PAID,
            PYMT_FULFILMENT_STATUS=fulfilment,
            PYMT_PROVIDER_PAYMENT_ID=f"pay_{payment.pk}",
            PYMT_PROVIDER_INTENT_ID=f"pi_{payment.pk}",
            PYMT_PAID_AT=self.now,
            PYMT_VERIFIED_AT=self.now,
            PYMT_FULFILLED_AT=fulfilled_at,
        )
        payment.refresh_from_db()
        return payment

    def grant(
        self,
        *,
        payment=None,
        business=None,
        start=None,
        end=None,
    ):
        return PaidMerchantPlusEntitlement.objects.create(
            BUSN_ID=business or self.business_a,
            PYMT_ID=payment or self.payment,
            MPPE_STARTS_AT=start or self.now - timedelta(minutes=1),
            MPPE_EXPIRES_AT=end or self.now + timedelta(days=30),
        )

    def assert_update_rejected(
        self,
        **values,
    ):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.filter(pk=self.payment.pk).update(**values)

    def event(
        self,
        **overrides,
    ):
        values = {
            "PWEV_PROVIDER_EVENT_ID": "evt_foundation",
            "PWEV_TYPE": "checkout_session.payment.paid",
            "PWEV_MODE": "test",
            "PWEV_PAYLOAD_DIGEST": "a" * 64,
            "PWEV_PROVIDER_CREATED_AT": self.now,
        }
        values.update(overrides)
        return PayMongoWebhookEvent.objects.create(**values)

    def test_creation_has_fixed_snapshot_and_pending_defaults(self):
        self.assertTrue(self.created)
        self.assertIsInstance(self.payment.PYMT_REFERENCE, uuid.UUID)
        self.assertEqual(self.payment.PYMT_PRODUCT, "merchant_plus")
        self.assertEqual(self.payment.PYMT_PRODUCT_VERSION, "capstone-v1")
        self.assertEqual(self.payment.PYMT_AMOUNT_CENTAVOS, 100)
        self.assertEqual(self.payment.PYMT_CURRENCY, "PHP")
        self.assertEqual(self.payment.PYMT_ACCESS_DURATION_DAYS, 30)
        self.assertEqual(self.payment.PYMT_STATUS, "pending")
        self.assertEqual(self.payment.PYMT_FULFILMENT_STATUS, "not_started")
        self.assertIsNone(self.payment.PYMT_PROVIDER_PAYMENT_ID)
        self.assertEqual(PaymentService.get_product()["payment_type"], "one-time")
        self.assertFalse(PaymentCheckoutSession.objects.exists())
        self.assertFalse(PayMongoWebhookEvent.objects.exists())

    def test_product_lookup_cannot_mutate_the_server_offer(self):
        product = PaymentService.get_product()
        product["amount_centavos"] = 1
        self.assertEqual(PaymentService.get_product()["amount_centavos"], 100)

    def test_client_price_and_mode_overrides_are_not_service_arguments(self):
        for values in ({"amount_centavos": 1}, {"mode": "live"}):
            with self.subTest(values=values):
                with self.assertRaises(TypeError):
                    PaymentService.create_or_get_payment(self.merchant_a, **values)

    def test_expired_access_can_be_explicitly_purchased_again(self):
        self.mark_paid()
        self.grant(end=self.now - timedelta(seconds=1))
        payment, created = PaymentService.create_or_get_payment(self.merchant_a)
        self.assertTrue(created)
        self.assertNotEqual(payment.pk, self.payment.pk)

    def test_missing_grant_is_not_a_reason_to_charge_a_paid_customer_again(self):
        self.mark_paid()
        payment, created = PaymentService.create_or_get_payment(self.merchant_a)
        self.assertFalse(created)
        self.assertEqual(payment.pk, self.payment.pk)

    def test_invalid_amount_currency_duration_and_states_are_rejected(self):
        for values in (
            {"PYMT_AMOUNT_CENTAVOS": 0},
            {"PYMT_AMOUNT_CENTAVOS": -1},
            {"PYMT_CURRENCY": "USD"},
            {"PYMT_ACCESS_DURATION_DAYS": 0},
            {"PYMT_MODE": "fake"},
            {"PYMT_STATUS": "failed"},
            {"PYMT_FULFILMENT_STATUS": "fake"},
        ):
            with self.subTest(values=values):
                self.assert_update_rejected(**values)

    def test_reference_and_snapshot_cannot_be_changed_on_save(self):
        for field, value in (
            ("PYMT_REFERENCE", uuid.uuid4()),
            ("PYMT_AMOUNT_CENTAVOS", 999),
            ("PYMT_MODE", "live"),
            ("USER_ID_id", self.merchant_b.pk),
        ):
            with self.subTest(field=field):
                self.payment.refresh_from_db()
                setattr(self.payment, field, value)
                with self.assertRaises(DjangoValidationError):
                    self.payment.save()

    def test_reference_is_unique_in_the_database(self):
        other, _ = PaymentService.create_or_get_payment(self.merchant_b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.filter(pk=other.pk).update(PYMT_REFERENCE=self.payment.PYMT_REFERENCE)

    def test_paid_requires_both_provider_ids_and_confirmation_timestamps(self):
        self.assert_update_rejected(PYMT_STATUS="paid")
        self.mark_paid()
        for field in (
            "PYMT_PROVIDER_PAYMENT_ID", "PYMT_PROVIDER_INTENT_ID",
            "PYMT_PAID_AT", "PYMT_VERIFIED_AT",
        ):
            with self.subTest(field=field):
                self.assert_update_rejected(**{field: None})
        self.assert_update_rejected(PYMT_PROVIDER_PAYMENT_ID="")
        self.assert_update_rejected(PYMT_PROVIDER_INTENT_ID="")

    def test_fulfilment_requires_paid_and_fulfilled_requires_timestamp(self):
        for state in ("pending", "fulfilled", "needs_attention"):
            self.assert_update_rejected(PYMT_FULFILMENT_STATUS=state)
        self.mark_paid()
        self.assert_update_rejected(PYMT_FULFILLED_AT=None)

    def test_provider_payment_id_is_unique_within_mode_only(self):
        self.mark_paid()
        other, _ = PaymentService.create_or_get_payment(self.merchant_b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.filter(pk=other.pk).update(
                PYMT_PROVIDER_PAYMENT_ID=self.payment.PYMT_PROVIDER_PAYMENT_ID,
            )
        with override_settings(PAYMONGO_MODE="live"):
            live, _ = PaymentService.create_or_get_payment(self.merchant_b)
        Payment.objects.filter(pk=live.pk).update(
            PYMT_PROVIDER_PAYMENT_ID=self.payment.PYMT_PROVIDER_PAYMENT_ID,
        )

    def test_one_unresolved_purchase_is_enforced_in_the_database(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.create(
                USER_ID=self.merchant_a,
                BUSN_ID=self.business_a,
                PYMT_PRODUCT="merchant_plus",
                PYMT_PRODUCT_VERSION="capstone-v1",
                PYMT_AMOUNT_CENTAVOS=100,
                PYMT_CURRENCY="PHP",
                PYMT_ACCESS_DURATION_DAYS=30,
                PYMT_MODE="test",
            )

    def test_unresolved_payment_is_reused_without_touching_its_snapshot(self):
        repeated, created = PaymentService.create_or_get_payment(self.merchant_a)
        self.assertFalse(created)
        self.assertEqual(repeated.pk, self.payment.pk)
        self.assertEqual(repeated.PYMT_UPDATED_AT, self.payment.PYMT_UPDATED_AT)
        state = PaymentService.get_purchase_eligibility(self.merchant_a)
        self.assertFalse(state["eligible"])
        self.assertEqual(state["reason"], "payment_unresolved")

    def test_paid_unfulfilled_purchase_remains_unresolved(self):
        self.mark_paid(fulfilled=False)
        self.assertEqual(PaymentService.get_unresolved_payment(self.merchant_a), self.payment)
        repeated, created = PaymentService.create_or_get_payment(self.merchant_a)
        self.assertFalse(created)
        self.assertEqual(repeated.pk, self.payment.pk)

    def test_ownership_and_merchant_status_are_enforced(self):
        self.assertEqual(PaymentService.get_owned_business(self.merchant_a), self.business_a)
        with self.assertRaises(PermissionDenied):
            PaymentService.create_or_get_payment(self.merchant_a, business_id=self.business_b.pk)
        with self.assertRaises(NotFound):
            PaymentService.get_owned_payment(self.merchant_b, self.payment.pk)
        for user in (self.supporter_a, None):
            with self.assertRaises(PermissionDenied):
                PaymentService.create_or_get_payment(user)
        self.merchant_a.USER_STATUS = User.UserStatus.SUSPENDED
        with self.assertRaises(PermissionDenied):
            PaymentService.create_or_get_payment(self.merchant_a)

    def test_test_and_live_reservations_are_separate_and_history_retains_mode(self):
        with override_settings(PAYMONGO_MODE="live"):
            self.assertIsNone(PaymentService.get_unresolved_payment(self.merchant_a))
            live, created = PaymentService.create_or_get_payment(self.merchant_a)
            self.assertTrue(created)
            self.assertNotEqual(live.pk, self.payment.pk)
            historical = PaymentService.get_owned_payment(self.merchant_a, self.payment.pk)
            self.assertEqual(historical.PYMT_MODE, "test")

    def test_active_paid_grant_allows_test_access_and_blocks_repurchase(self):
        self.mark_paid()
        entitlement = self.grant()
        self.assertEqual(PaymentService.get_active_paid_entitlement(self.merchant_a), entitlement)
        self.assertTrue(merchant_has_plus_access(self.merchant_a))
        with self.assertRaises(ValidationError):
            PaymentService.create_or_get_payment(self.merchant_a)
        self.assertEqual(
            PaymentService.get_purchase_eligibility(self.merchant_a)["reason"],
            "paid_access_active",
        )

    def test_test_paid_grant_does_not_allow_live_access(self):
        self.mark_paid()
        self.grant()
        with override_settings(PAYMONGO_MODE="live"):
            self.assertFalse(merchant_has_plus_access(self.merchant_a))
            self.assertTrue(PaymentService.get_purchase_eligibility(self.merchant_a)["eligible"])

    def test_expired_and_future_grants_do_not_allow_access(self):
        self.mark_paid()
        entitlement = self.grant(end=self.now - timedelta(seconds=1))
        self.assertFalse(merchant_has_plus_access(self.merchant_a))
        PaidMerchantPlusEntitlement.objects.filter(pk=entitlement.pk).update(
            MPPE_STARTS_AT=self.now + timedelta(days=1),
            MPPE_EXPIRES_AT=self.now + timedelta(days=31),
        )
        self.assertFalse(merchant_has_plus_access(self.merchant_a))

    def test_unpaid_and_unfulfilled_records_cannot_grant_access(self):
        self.grant()
        self.assertFalse(merchant_has_plus_access(self.merchant_a))
        self.mark_paid(fulfilled=False)
        self.assertFalse(merchant_has_plus_access(self.merchant_a))

    def test_mismatched_grant_business_is_denied_and_fails_validation(self):
        self.mark_paid()
        entitlement = self.grant(business=self.business_b)
        with self.assertRaises(DjangoValidationError):
            entitlement.full_clean()
        self.assertFalse(merchant_has_plus_access(self.merchant_a))
        self.assertFalse(merchant_has_plus_access(self.merchant_b))

    def test_entitlement_is_unique_and_requires_expiry_after_start(self):
        self.mark_paid()
        self.grant()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.grant()
        with self.assertRaises(IntegrityError), transaction.atomic():
            PaidMerchantPlusEntitlement.objects.update(MPPE_EXPIRES_AT=self.now - timedelta(days=1))

    def test_financial_history_is_protected_from_owner_and_business_deletion(self):
        for record in (self.business_a, self.merchant_a, self.payment):
            if record == self.payment:
                self.mark_paid()
                self.grant()
            with self.assertRaises(ProtectedError), transaction.atomic():
                record.delete()

    def test_checkout_operations_are_unique_and_unknown_blocks_another_operation(self):
        session = PaymentCheckoutSession.objects.create(PYMT_ID=self.payment, PCHK_MODE="test")
        session.PCHK_STATE = "creation_unknown"
        session.save()
        with self.assertRaises(IntegrityError), transaction.atomic():
            PaymentCheckoutSession.objects.create(PYMT_ID=self.payment, PCHK_MODE="test")
        original_reference = session.PCHK_OPERATION_REFERENCE
        session.PCHK_OPERATION_REFERENCE = uuid.uuid4()
        with self.assertRaises(DjangoValidationError):
            session.save()
        session.PCHK_OPERATION_REFERENCE = original_reference
        session.PCHK_STATE = "creation_failed"
        session.save()
        PaymentCheckoutSession.objects.create(PYMT_ID=self.payment, PCHK_MODE="test")

    def test_checkout_ready_requires_provider_identity_and_mode_must_match(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            PaymentCheckoutSession.objects.create(
                PYMT_ID=self.payment,
                PCHK_MODE="test",
                PCHK_STATE="ready",
            )
        with self.assertRaises(DjangoValidationError):
            PaymentCheckoutSession.objects.create(PYMT_ID=self.payment, PCHK_MODE="live")

    def test_checkout_provider_identity_is_unique_within_mode(self):
        PaymentCheckoutSession.objects.create(
            PYMT_ID=self.payment,
            PCHK_MODE="test",
            PCHK_PROVIDER_SESSION_ID="cs_unique",
        )
        other, _ = PaymentService.create_or_get_payment(self.merchant_b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PaymentCheckoutSession.objects.create(
                PYMT_ID=other,
                PCHK_MODE="test",
                PCHK_PROVIDER_SESSION_ID="cs_unique",
            )
        with override_settings(PAYMONGO_MODE="live"):
            live, _ = PaymentService.create_or_get_payment(self.merchant_a)
        PaymentCheckoutSession.objects.create(
            PYMT_ID=live,
            PCHK_MODE="live",
            PCHK_PROVIDER_SESSION_ID="cs_unique",
        )

    def test_webhook_event_deduplication_is_scoped_to_mode(self):
        event = self.event()
        self.assertEqual(event.PWEV_STATE, "queued")
        self.assertIsNone(event.PYMT_ID_id)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.event()
        self.event(PWEV_MODE="live")

    def test_event_rejects_sensitive_nested_and_oversized_payloads(self):
        for payload in (
            {"billing": {"email": "private@example.com"}},
            {"signature": "secret"},
            {"status": {"nested": "payload"}},
            {"status": "x" * 17000},
        ):
            with self.subTest(payload_keys=list(payload)):
                with self.assertRaises(DjangoValidationError):
                    self.event(PWEV_DATA=payload)

    def test_event_relationships_and_processed_timestamps_are_validated(self):
        with self.assertRaises(DjangoValidationError):
            self.event(PYMT_ID=self.payment, PWEV_MODE="live")
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.event(PWEV_STATE="processed")


@override_settings(PAYMONGO_MODE="test")
class PaymentConcurrencyTests(MerchantAnalyticsFixtures, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.setUpTestData()

    def test_concurrent_local_reservations_reuse_one_payment(self):
        self.assertEqual(connection.vendor, "postgresql")
        barrier = Barrier(2)

        def reserve():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                user = User.objects.get(pk=self.merchant_a.pk)
                barrier.wait(timeout=10)
                payment, created = PaymentService.create_or_get_payment(user)
                return payment.pk, created
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: reserve(), range(2)))
        self.assertEqual(len({result[0] for result in results}), 1)
        self.assertEqual(sum(result[1] for result in results), 1)
        self.assertEqual(Payment.objects.count(), 1)
