from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

from apps.merchant_operations.merchant_analytics.services.tests.fixtures import MerchantAnalyticsFixtures


class PaymentProviderMigrationTests(MerchantAnalyticsFixtures, TransactionTestCase):
    """Verify the real PostgreSQL upgrade with Task 3A payment history."""

    def test_upgrade_preserves_paid_and_unresolved_paymongo_history(self):
        self.assertEqual(connection.vendor, "postgresql")
        self.setUpTestData()
        previous = [
            ("payments", "0001_payment_foundation"),
            ("merchant_analytics", "0005_payment_foundation"),
        ]
        target = [
            ("payments", "0003_provider_neutral_foundation"),
            ("merchant_analytics", "0005_payment_foundation"),
        ]
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        try:
            executor.migrate(previous)
            old_apps = executor.loader.project_state(previous).apps
            payments = old_apps.get_model("payments", "Payment")
            checkouts = old_apps.get_model("payments", "PaymentCheckoutSession")
            inbox = old_apps.get_model("payments", "PayMongoWebhookEvent")
            grants = old_apps.get_model("merchant_analytics", "PaidMerchantPlusEntitlement")

            now = timezone.now()
            snapshot = {
                "USER_ID_id": self.merchant_a.pk,
                "BUSN_ID_id": self.business_a.pk,
                "PYMT_PRODUCT": "merchant_plus",
                "PYMT_PRODUCT_VERSION": "capstone-v1",
                "PYMT_AMOUNT_CENTAVOS": 100,
                "PYMT_CURRENCY": "PHP",
                "PYMT_ACCESS_DURATION_DAYS": 30,
                "PYMT_MODE": "test",
            }
            paid = payments.objects.create(
                **snapshot,
                PYMT_STATUS="paid",
                PYMT_FULFILMENT_STATUS="fulfilled",
                PYMT_PAID_AT=now,
                PYMT_VERIFIED_AT=now,
                PYMT_FULFILLED_AT=now,
                PYMT_PROVIDER_PAYMENT_ID="pay_fixture",
                PYMT_PROVIDER_INTENT_ID="pi_fixture",
            )
            unresolved = payments.objects.create(**snapshot)
            checkout = checkouts.objects.create(
                PYMT_ID=paid,
                PCHK_MODE="test",
                PCHK_STATE="completed",
                PCHK_PROVIDER_SESSION_ID="cs_fixture",
                PCHK_CHECKOUT_URL="https://checkout.paymongo.com/mock",
                PCHK_INTENT_ID="pi_fixture",
                PCHK_INTENT_STATUS="succeeded",
            )
            unknown = checkouts.objects.create(
                PYMT_ID=unresolved,
                PCHK_MODE="test",
                PCHK_STATE="creation_unknown",
            )
            event = inbox.objects.create(
                PYMT_ID=paid,
                PCHK_ID=checkout,
                PWEV_MODE="test",
                PWEV_PROVIDER_EVENT_ID="evt_fixture",
                PWEV_PROVIDER_SESSION_ID="cs_fixture",
                PWEV_TYPE="checkout_session.payment.paid",
                PWEV_DATA={"livemode": False, "payment_intent_id": "pi_fixture"},
                PWEV_PAYLOAD_DIGEST="a" * 64,
                PWEV_PROVIDER_CREATED_AT=now,
                PWEV_STATE="processed",
                PWEV_PROCESSED_AT=now,
            )
            grant = grants.objects.create(
                BUSN_ID_id=self.business_a.pk,
                PYMT_ID=paid,
                MPPE_STARTS_AT=now,
                MPPE_EXPIRES_AT=now + timedelta(days=30),
            )

            executor = MigrationExecutor(connection)
            executor.migrate(target)
            new_apps = executor.loader.project_state(target).apps
            payments = new_apps.get_model("payments", "Payment")
            checkouts = new_apps.get_model("payments", "PaymentCheckoutSession")
            inbox = new_apps.get_model("payments", "PaymentProviderEvent")
            grants = new_apps.get_model("merchant_analytics", "PaidMerchantPlusEntitlement")

            restored_payment = payments.objects.get(pk=paid.pk)
            self.assertEqual(restored_payment.PYMT_PROVIDER, "paymongo")
            self.assertEqual(restored_payment.PYMT_REFERENCE, paid.PYMT_REFERENCE)
            self.assertEqual(restored_payment.PYMT_PROVIDER_PAYMENT_ID, "pay_fixture")
            self.assertEqual(restored_payment.PYMT_PROVIDER_INTENT_ID, "pi_fixture")
            self.assertEqual(restored_payment.PYMT_VERIFIED_AT, now)
            restored_unresolved = payments.objects.get(pk=unresolved.pk)
            self.assertEqual(restored_unresolved.PYMT_PROVIDER, "paymongo")
            self.assertEqual(restored_unresolved.PYMT_STATUS, "pending")
            self.assertEqual(checkouts.objects.get(pk=unknown.pk).PCHK_STATE, "creation_unknown")

            restored_checkout = checkouts.objects.get(pk=checkout.pk)
            self.assertEqual(restored_checkout.PCHK_PROVIDER, "paymongo")
            self.assertEqual(restored_checkout.PCHK_OPERATION_REFERENCE, checkout.PCHK_OPERATION_REFERENCE)
            self.assertEqual(restored_checkout.PCHK_PROVIDER_SESSION_ID, "cs_fixture")
            self.assertEqual(restored_checkout.PCHK_CHECKOUT_URL, checkout.PCHK_CHECKOUT_URL)
            self.assertEqual(restored_checkout.PCHK_INTENT_ID, "pi_fixture")
            self.assertEqual(restored_checkout.PCHK_INTENT_STATUS, "succeeded")

            restored_event = inbox.objects.get(pk=event.pk)
            self.assertEqual(restored_event.PWEV_PROVIDER, "paymongo")
            self.assertEqual(restored_event.PWEV_DEDUPE_KEY, "evt_fixture")
            self.assertEqual(restored_event.PWEV_PROVIDER_CHECKOUT_ID, "cs_fixture")
            self.assertEqual(restored_event.PWEV_DATA, event.PWEV_DATA)
            self.assertEqual(restored_event.PWEV_PAYLOAD_DIGEST, event.PWEV_PAYLOAD_DIGEST)
            self.assertEqual(restored_event.PWEV_PROCESSED_AT, now)
            self.assertEqual(restored_event.PYMT_ID_id, paid.pk)
            self.assertEqual(restored_event.PCHK_ID_id, checkout.pk)

            restored_grant = grants.objects.get(pk=grant.pk)
            self.assertEqual(restored_grant.PYMT_ID_id, paid.pk)
            self.assertEqual(restored_grant.BUSN_ID_id, self.business_a.pk)
            self.assertEqual(restored_grant.MPPE_EXPIRES_AT, grant.MPPE_EXPIRES_AT)
            self.assertIn("PAYMENT_PROVIDER_EVENT", connection.introspection.table_names())
            self.assertNotIn("PAYMONGO_WEBHOOK_EVENT", connection.introspection.table_names())
        finally:
            MigrationExecutor(connection).migrate(latest)
