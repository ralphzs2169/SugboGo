from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0008_businessreviewsummary_narrative_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_KEYWORDS_ATTEMPT_FINGERPRINT",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
            ),
        ),
    ]
