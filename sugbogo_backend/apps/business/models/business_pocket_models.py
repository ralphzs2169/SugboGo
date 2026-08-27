from django.conf import settings
from django.db import models

from .business_core_models import Business


class BusinessPocket(models.Model):
    PCKT_ID = models.AutoField(primary_key=True)

    PCKT_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PCKT_UPDATED_AT = models.DateTimeField(auto_now=True)

    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="business_pockets",
    )

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="pocket_entries",
    )

    class Meta:
        db_table = "BUSINESS_POCKET"
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=["USER_ID", "BUSN_ID"],
                name="unique_user_business_pocket",
            ),
        ]