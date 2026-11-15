from django.db import migrations, models
from django.db.models import OuterRef, Subquery


def backfill_provider_provenance(
    apps,
    schema_editor,
):
    """Label the existing rows and copy each checkout's provider from its payment."""
    database = schema_editor.connection.alias
    payments = apps.get_model("payments", "Payment").objects.using(database)
    checkouts = apps.get_model("payments", "PaymentCheckoutSession").objects.using(database)
    events = apps.get_model("payments", "PayMongoWebhookEvent").objects.using(database)

    payments.filter(PYMT_PROVIDER__isnull=True).update(PYMT_PROVIDER="paymongo")
    parent_provider = payments.filter(pk=OuterRef("PYMT_ID_id")).values("PYMT_PROVIDER")[:1]
    checkouts.filter(PCHK_PROVIDER__isnull=True).update(
        PCHK_PROVIDER=Subquery(parent_provider),
    )
    events.filter(PWEV_PROVIDER__isnull=True).update(PWEV_PROVIDER="paymongo")


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0001_payment_foundation"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="PYMT_PROVIDER",
            field=models.CharField(max_length=8, null=True),
        ),
        migrations.AddField(
            model_name="paymentcheckoutsession",
            name="PCHK_PROVIDER",
            field=models.CharField(max_length=8, null=True),
        ),
        migrations.AddField(
            model_name="paymongowebhookevent",
            name="PWEV_PROVIDER",
            field=models.CharField(max_length=8, null=True),
        ),
        migrations.RunPython(
            backfill_provider_provenance,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
