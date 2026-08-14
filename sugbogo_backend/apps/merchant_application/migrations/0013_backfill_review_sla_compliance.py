from datetime import timedelta

from django.db import migrations


def backfill_sla_compliance(apps, schema_editor):
    MerchantApplicationReview = apps.get_model(
        "merchant_application",
        "MerchantApplicationReview",
    )

    APPLICATION_REVIEW_SLA_BUSINESS_DAYS = 5

    reviews = (
        MerchantApplicationReview.objects
        .filter(
            MAREV_SLA_COMPLIANT__isnull=True,
            MASUB_ID__isnull=False,
        )
        .select_related("MASUB_ID")
    )

    for review in reviews:
        submission = review.MASUB_ID

        start = submission.MASUB_SUBMITTED_AT
        end = review.MAREV_REVIEWED_AT

        start_date = start.date() if hasattr(start, "date") else start
        end_date = end.date() if hasattr(end, "date") else end

        business_days = 0
        current_date = start_date + timedelta(days=1)

        while current_date <= end_date:
            if current_date.weekday() < 5:
                business_days += 1

            current_date += timedelta(days=1)

        review.MAREV_SLA_COMPLIANT = (
            business_days < APPLICATION_REVIEW_SLA_BUSINESS_DAYS
        )

        review.save(
            update_fields=["MAREV_SLA_COMPLIANT"],
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "merchant_application",
            "0012_merchantapplicationreview_marev_sla_compliant",
        ),
    ]

    operations = [
        migrations.RunPython(
            backfill_sla_compliance,
            migrations.RunPython.noop,
        ),
    ]