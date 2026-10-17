"""Create recommendations independently of the unmerged demo-entitlement root."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("business", "0028_rename_vouch_installation_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MerchantRecommendation",
            fields=[
                ("MREC_ID", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("MREC_SELECTION_KEY", models.CharField(max_length=64)),
                ("MREC_PERIOD", models.JSONField(default=dict)),
                ("MREC_SNAPSHOT", models.JSONField(default=dict)),
                ("MREC_FINGERPRINT", models.CharField(max_length=64)),
                ("MREC_POLICY_VERSION", models.PositiveBigIntegerField()),
                ("MREC_POLICY_VALUES", models.JSONField(default=dict)),
                ("MREC_PROVENANCE", models.JSONField(default=dict)),
                ("MREC_STATE", models.CharField(
                    choices=[("pending", "Pending"), ("running", "Running"), ("ready", "Ready"),
                             ("insufficient_data", "Insufficient data"), ("failed", "Failed"),
                             ("invalidated", "Invalidated")], default="pending", max_length=24,
                )),
                ("MREC_OUTPUT", models.JSONField(default=list)),
                ("MREC_ERROR_CODE", models.CharField(blank=True, default="", max_length=48)),
                ("MREC_ATTEMPTS", models.PositiveSmallIntegerField(default=0)),
                ("MREC_STARTED_AT", models.DateTimeField(blank=True, null=True)),
                ("MREC_GENERATED_AT", models.DateTimeField(blank=True, null=True)),
                ("MREC_FINISHED_AT", models.DateTimeField(blank=True, null=True)),
                ("MREC_CREATED_AT", models.DateTimeField(auto_now_add=True)),
                ("MREC_UPDATED_AT", models.DateTimeField(auto_now=True)),
                ("BUSN_ID", models.ForeignKey(
                    db_column="BUSN_ID", on_delete=django.db.models.deletion.CASCADE,
                    related_name="analytics_recommendations", to="business.business",
                )),
                ("USER_ID", models.ForeignKey(
                    db_column="USER_ID", on_delete=django.db.models.deletion.CASCADE,
                    related_name="analytics_recommendations", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "MERCHANT_ANALYTICS_RECOMMENDATION",
                "ordering": ["-MREC_CREATED_AT"],
                "indexes": [models.Index(
                    fields=["BUSN_ID", "USER_ID", "MREC_SELECTION_KEY", "-MREC_CREATED_AT"],
                    name="mrec_owner_selection_idx",
                )],
            },
        ),
    ]
