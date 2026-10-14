"""Demo-only merchant Plus access; this is not a paid subscription or payment ledger."""

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
