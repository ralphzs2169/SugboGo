"""Persist paid Merchant Plus access."""

from django.core.exceptions import ValidationError
from django.db import models

from apps.business.models import Business


class PaidMerchantPlusEntitlement(models.Model):
    """Link a protected paid purchase to its first successfully activated access period."""

    MPPE_ID = models.BigAutoField(primary_key=True)
    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.PROTECT,
        db_column="BUSN_ID",
        related_name="paid_plus_entitlements",
    )
    PYMT_ID = models.OneToOneField(
        "payments.Payment",
        on_delete=models.PROTECT,
        db_column="PYMT_ID",
        related_name="paid_plus_entitlement",
    )
    MPPE_STARTS_AT = models.DateTimeField()
    MPPE_EXPIRES_AT = models.DateTimeField()
    MPPE_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MPPE_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "PAID_MERCHANT_PLUS_ENTITLEMENT"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(MPPE_EXPIRES_AT__gt=models.F("MPPE_STARTS_AT")),
                name="paid_plus_expiry_after_start",
            ),
        ]
        indexes = [
            models.Index(
                fields=["BUSN_ID", "MPPE_EXPIRES_AT"],
                name="paid_plus_business_expiry",
            ),
        ]

    def clean(self):
        """Validate the grant's business and successful purchase without cross-table checks."""
        super().clean()
        if self.PYMT_ID_id:
            payment = self.PYMT_ID
            if (
                payment.BUSN_ID_id != self.BUSN_ID_id
                or payment.USER_ID_id != self.BUSN_ID.USER_ID_id
                or payment.PYMT_PRODUCT != "merchant_plus"
                or payment.PYMT_STATUS != "paid"
            ):
                raise ValidationError(
                    "Paid Plus requires the business owner's successful Merchant Plus payment.",
                )
