import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("merchant_application", "0006_merchantapplication_mapp_submission_count"),
    ]

    operations = [
        migrations.CreateModel(
            name="MerchantApplicationReview",
            fields=[
                (
                    "MAREV_ID",
                    models.AutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "MAREV_DECISION",
                    models.CharField(
                        choices=[
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "MAREV_REVIEWED_AT",
                    models.DateTimeField(),
                ),
                (
                    "MAREV_CREATED_AT",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "MAREV_UPDATED_AT",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "MAPP_ID",
                    models.ForeignKey(
                        db_column="MAPP_ID",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviews",
                        to="merchant_application.merchantapplication",
                    ),
                ),
                (
                    "USER_ID",
                    models.ForeignKey(
                        db_column="USER_ID",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="merchant_application_reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "MERCHANT_APPLICATION_REVIEW",
                "ordering": ["-MAREV_REVIEWED_AT"],
            },
        ),

        migrations.RemoveField(
            model_name="merchantapplicationfeedback",
            name="MAPP_ID",
        ),

        migrations.AddField(
            model_name="merchantapplicationfeedback",
            name="MAREV_ID",
            field=models.ForeignKey(
                db_column="MAREV_ID",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="feedback",
                to="merchant_application.merchantapplicationreview",
            ),
        ),

        migrations.AddField(
            model_name="merchantapplicationfeedback",
            name="MAPF_UPDATED_AT",
            field=models.DateTimeField(auto_now=True),
        ),
    ]