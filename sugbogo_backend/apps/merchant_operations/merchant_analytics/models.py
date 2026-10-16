"""Demo Plus access and explicitly requested merchant recommendation jobs."""

import uuid

from django.conf import settings
from django.db import models

from apps.business.models import Business


class DemoMerchantPlusEntitlement(models.Model):
    """Persist one reversible simulation grant for an owned business."""

    DMPE_ID = models.AutoField(primary_key=True)
    BUSN_ID = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="demo_plus_entitlement",
    )
    DMPE_IS_ACTIVE = models.BooleanField(default=False)
    DMPE_ACTIVATED_AT = models.DateTimeField(null=True, blank=True)
    DMPE_RESET_AT = models.DateTimeField(null=True, blank=True)
    DMPE_CREATED_AT = models.DateTimeField(auto_now_add=True)
    DMPE_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "DEMO_MERCHANT_PLUS_ENTITLEMENT"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(DMPE_IS_ACTIVE=False) | models.Q(DMPE_ACTIVATED_AT__isnull=False),
                name="demo_plus_active_has_activation_time",
            ),
        ]


class MerchantRecommendation(models.Model):
    """Keep one immutable source snapshot and bounded attempt lifecycle per refresh."""

    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        READY = "ready", "Ready"
        INSUFFICIENT = "insufficient_data", "Insufficient data"
        FAILED = "failed", "Failed"
        INVALIDATED = "invalidated", "Invalidated"

    MREC_ID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    BUSN_ID = models.ForeignKey(
        "business.Business", on_delete=models.CASCADE, db_column="BUSN_ID",
        related_name="analytics_recommendations",
    )
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, db_column="USER_ID",
        related_name="analytics_recommendations",
    )
    MREC_SELECTION_KEY = models.CharField(max_length=64)
    MREC_PERIOD = models.JSONField(default=dict)
    MREC_SNAPSHOT = models.JSONField(default=dict)
    MREC_FINGERPRINT = models.CharField(max_length=64)
    MREC_POLICY_VERSION = models.PositiveBigIntegerField()
    MREC_POLICY_VALUES = models.JSONField(default=dict)
    MREC_PROVENANCE = models.JSONField(default=dict)
    MREC_STATE = models.CharField(max_length=24, choices=State.choices, default=State.PENDING)
    MREC_OUTPUT = models.JSONField(default=list)
    MREC_ERROR_CODE = models.CharField(max_length=48, blank=True, default="")
    MREC_ATTEMPTS = models.PositiveSmallIntegerField(default=0)
    MREC_STARTED_AT = models.DateTimeField(null=True, blank=True)
    MREC_GENERATED_AT = models.DateTimeField(null=True, blank=True)
    MREC_FINISHED_AT = models.DateTimeField(null=True, blank=True)
    MREC_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MREC_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "MERCHANT_ANALYTICS_RECOMMENDATION"
        ordering = ["-MREC_CREATED_AT"]
        indexes = [
            models.Index(
                fields=["BUSN_ID", "USER_ID", "MREC_SELECTION_KEY", "-MREC_CREATED_AT"],
                name="mrec_owner_selection_idx",
            ),
        ]
