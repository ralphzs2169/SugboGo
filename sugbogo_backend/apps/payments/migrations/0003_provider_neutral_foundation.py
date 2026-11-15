from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def check_legacy_rollback(
    apps,
    schema_editor,
):
    """Refuse rollback when the old schema cannot represent stored evidence."""
    database = schema_editor.connection.alias
    payments = apps.get_model("payments", "Payment").objects.using(database)
    checkouts = apps.get_model("payments", "PaymentCheckoutSession").objects.using(database)
    events = apps.get_model("payments", "PaymentProviderEvent").objects.using(database)
    if (
        payments.exclude(PYMT_PROVIDER="paymongo").exists()
        or checkouts.exclude(PCHK_PROVIDER="paymongo").exists()
        or events.exclude(PWEV_PROVIDER="paymongo").exists()
        or events.filter(PWEV_PROVIDER_CREATED_AT__isnull=True).exists()
    ):
        raise IrreversibleError("The Task 3A schema cannot preserve this provider data.")

    checkouts.filter(PCHK_INTENT_ID__isnull=True).update(PCHK_INTENT_ID="")
    checkouts.filter(PCHK_INTENT_STATUS__isnull=True).update(PCHK_INTENT_STATUS="")


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_backfill_provider_provenance"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="PayMongoWebhookEvent",
            new_name="PaymentProviderEvent",
        ),
        migrations.AlterModelTable(
            name="paymentproviderevent",
            table="PAYMENT_PROVIDER_EVENT",
        ),
        migrations.RemoveConstraint(
            model_name="paymentproviderevent",
            name="paymongo_event_mode_unique",
        ),
        migrations.RemoveIndex(
            model_name="paymentproviderevent",
            name="paymongo_event_session",
        ),
        migrations.RenameField(
            model_name="paymentproviderevent",
            old_name="PWEV_PROVIDER_EVENT_ID",
            new_name="PWEV_DEDUPE_KEY",
        ),
        migrations.RenameField(
            model_name="paymentproviderevent",
            old_name="PWEV_PROVIDER_SESSION_ID",
            new_name="PWEV_PROVIDER_CHECKOUT_ID",
        ),
        migrations.AlterField(
            model_name="payment",
            name="PYMT_PROVIDER",
            field=models.CharField(
                choices=[("paymongo", "PayMongo"), ("maya", "Maya")],
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="paymentcheckoutsession",
            name="PCHK_PROVIDER",
            field=models.CharField(
                choices=[("paymongo", "PayMongo"), ("maya", "Maya")],
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="paymentproviderevent",
            name="PWEV_PROVIDER",
            field=models.CharField(
                choices=[("paymongo", "PayMongo"), ("maya", "Maya")],
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="paymentcheckoutsession",
            name="PCHK_INTENT_ID",
            field=models.CharField(
                blank=True,
                max_length=128,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="paymentcheckoutsession",
            name="PCHK_INTENT_STATUS",
            field=models.CharField(
                blank=True,
                max_length=40,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="paymentproviderevent",
            name="PWEV_PROVIDER_CREATED_AT",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RemoveConstraint(
            model_name="payment",
            name="payment_provider_mode_unique",
        ),
        migrations.RemoveConstraint(
            model_name="payment",
            name="payment_paid_has_evidence",
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=models.Q(PYMT_PROVIDER__in=["paymongo", "maya"]),
                name="payment_valid_provider",
            ),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(PYMT_PROVIDER="paymongo")
                    | models.Q(PYMT_PROVIDER_INTENT_ID__isnull=True)
                ),
                name="payment_legacy_intent_provider",
            ),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(PYMT_STATUS="pending")
                    | (
                        models.Q(
                            PYMT_PROVIDER_PAYMENT_ID__isnull=False,
                            PYMT_PAID_AT__isnull=False,
                            PYMT_VERIFIED_AT__isnull=False,
                        )
                        & ~models.Q(PYMT_PROVIDER_PAYMENT_ID="")
                        & (
                            ~models.Q(PYMT_PROVIDER="paymongo")
                            | (
                                models.Q(PYMT_PROVIDER_INTENT_ID__isnull=False)
                                & ~models.Q(PYMT_PROVIDER_INTENT_ID="")
                            )
                        )
                    )
                ),
                name="payment_paid_has_evidence",
            ),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.UniqueConstraint(
                fields=["PYMT_PROVIDER", "PYMT_MODE", "PYMT_PROVIDER_PAYMENT_ID"],
                condition=models.Q(PYMT_PROVIDER_PAYMENT_ID__isnull=False),
                name="payment_provider_mode_unique",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="paymentcheckoutsession",
            name="checkout_provider_mode_unique",
        ),
        migrations.AddConstraint(
            model_name="paymentcheckoutsession",
            constraint=models.CheckConstraint(
                condition=models.Q(PCHK_PROVIDER__in=["paymongo", "maya"]),
                name="checkout_valid_provider",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentcheckoutsession",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(PCHK_PROVIDER="paymongo")
                    | models.Q(
                        PCHK_INTENT_ID__isnull=True,
                        PCHK_INTENT_STATUS__isnull=True,
                    )
                ),
                name="checkout_legacy_intent_provider",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentcheckoutsession",
            constraint=models.UniqueConstraint(
                fields=["PCHK_PROVIDER", "PCHK_MODE", "PCHK_PROVIDER_SESSION_ID"],
                condition=models.Q(PCHK_PROVIDER_SESSION_ID__isnull=False),
                name="checkout_provider_mode_unique",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="paymentproviderevent",
            name="paymongo_event_valid_mode",
        ),
        migrations.RemoveConstraint(
            model_name="paymentproviderevent",
            name="paymongo_event_valid_state",
        ),
        migrations.RemoveConstraint(
            model_name="paymentproviderevent",
            name="paymongo_event_processed_time",
        ),
        migrations.AddConstraint(
            model_name="paymentproviderevent",
            constraint=models.UniqueConstraint(
                fields=["PWEV_PROVIDER", "PWEV_MODE", "PWEV_DEDUPE_KEY"],
                name="provider_event_dedupe_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentproviderevent",
            constraint=models.CheckConstraint(
                condition=models.Q(PWEV_PROVIDER__in=["paymongo", "maya"]),
                name="provider_event_valid_provider",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentproviderevent",
            constraint=models.CheckConstraint(
                condition=models.Q(PWEV_MODE__in=["test", "live"]),
                name="provider_event_valid_mode",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentproviderevent",
            constraint=models.CheckConstraint(
                condition=models.Q(PWEV_STATE__in=[
                    "queued", "processing", "processed", "ignored", "needs_attention",
                ]),
                name="provider_event_valid_state",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentproviderevent",
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(PWEV_STATE__in=["processed", "ignored"])
                    | models.Q(PWEV_PROCESSED_AT__isnull=False)
                ),
                name="provider_event_processed_time",
            ),
        ),
        migrations.RenameIndex(
            model_name="paymentproviderevent",
            old_name="paymongo_event_due",
            new_name="provider_event_due",
        ),
        migrations.AddIndex(
            model_name="paymentproviderevent",
            index=models.Index(
                fields=["PWEV_PROVIDER", "PWEV_MODE", "PWEV_PROVIDER_CHECKOUT_ID"],
                name="provider_event_checkout",
            ),
        ),
        migrations.RunPython(
            migrations.RunPython.noop,
            reverse_code=check_legacy_rollback,
        ),
    ]
