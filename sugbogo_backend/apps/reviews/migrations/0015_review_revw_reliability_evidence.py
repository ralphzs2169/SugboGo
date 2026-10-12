from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0014_rename_report_attention_flag"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="REVW_RELIABILITY_EVIDENCE",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
