from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0007_businessreviewsummary_keyword_tracking"),
    ]

    operations = [
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_ANALYZED_REVIEW_COUNT",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_COVERAGE_END",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_COVERAGE_START",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_ELIGIBLE_REVIEW_COUNT",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_GENERATED_AT",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_GENERATION_STATE",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("insufficient_reviews", "Insufficient reviews"),
                    ("ready", "Ready"),
                    ("outdated", "Outdated"),
                ],
                default="pending",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_NARRATIVE",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="businessreviewsummary",
            name="BRSU_SUPPORTING_REVIEW_REFERENCES",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
