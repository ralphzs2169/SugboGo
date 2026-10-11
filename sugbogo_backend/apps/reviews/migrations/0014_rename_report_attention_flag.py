from django.db import migrations
from django.db.models import Count


def recompute_report_attention(apps, schema_editor):
    """Derive attention from pending reports instead of historical spam flags."""
    Review = apps.get_model("reviews", "Review")
    ReviewReport = apps.get_model("reviews", "ReviewReport")
    database = schema_editor.connection.alias

    Review.objects.using(database).all().update(
        REVW_IS_REPORT_FLAGGED=False,
    )
    flagged_review_ids = list(
        ReviewReport.objects.using(database)
        .filter(
            RREP_STATUS="pending",
            REVW_ID__REVW_STATUS="published",
        )
        .values("REVW_ID_id")
        .annotate(pending_count=Count("RREP_ID"))
        .filter(pending_count__gte=3)
        .values_list("REVW_ID_id", flat=True)
    )
    if flagged_review_ids:
        Review.objects.using(database).filter(
            pk__in=flagged_review_ids,
        ).update(
            REVW_IS_REPORT_FLAGGED=True,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0013_review_revw_reliability_reasons"),
    ]

    operations = [
        migrations.RenameField(
            model_name="review",
            old_name="REVW_IS_SPAM_FLAGGED",
            new_name="REVW_IS_REPORT_FLAGGED",
        ),
        migrations.RunPython(
            recompute_report_attention,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
