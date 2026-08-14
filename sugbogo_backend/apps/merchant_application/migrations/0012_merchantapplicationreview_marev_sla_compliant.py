from datetime import timedelta

from django.db import migrations, models


def backfill_sla_compliance(apps, schema_editor):
    MerchantApplicationReview = apps.get_model(
        "merchant_application",
        "MerchantApplicationReview",
    )

    REVIEW_SLA_BUSINESS_DAYS = 5

    reviews = (
        MerchantApplicationReview.objects
        .select_related("MASUB_ID")
        .filter(MASUB_ID__isnull=False)
    )

    for review in reviews:
        start = review.MASUB_ID.MASUB_SUBMITTED_AT.date()
        end = review.MAREV_REVIEWED_AT.date()

        if end <= start:
            business_days = 0
        else:
            business_days = 0
            current_date = start + timedelta(days=1)

            while current_date <= end:
                if current_date.weekday() < 5:
                    business_days += 1

                current_date += timedelta(days=1)

        review.MAREV_SLA_COMPLIANT = (
            business_days < REVIEW_SLA_BUSINESS_DAYS
        )

        review.save(
            update_fields=["MAREV_SLA_COMPLIANT"],
        )


def reverse_sla_compliance(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        (
            "merchant_application",
            "0011_merchantapplicationsubmission_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="merchantapplicationreview",
            name="MAREV_SLA_COMPLIANT",
            field=models.BooleanField(
                blank=True,
                null=True,
            ),
        ),
        migrations.RunPython(
            backfill_sla_compliance,
            reverse_sla_compliance,
        ),
    ]