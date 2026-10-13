from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0015_review_revw_reliability_evidence"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="REVW_EDITED_AT",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
