from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0032_discovery_score_refresh_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="businessvouch",
            name="VOUCH_RELIABILITY_EVIDENCE",
            field=models.JSONField(
                default=dict,
                blank=True,
            ),
        ),
    ]
