from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0009_businessreviewsummary_keywords_attempt_fingerprint"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="REVW_SHOW_IN_COMMUNITY",
            field=models.BooleanField(default=True),
        ),
    ]
