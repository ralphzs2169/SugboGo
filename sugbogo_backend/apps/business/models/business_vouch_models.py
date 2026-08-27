
from django.db import models

from apps.users.models import User

from .business_core_models import Business
from .business_taxonomy_models import SpecialtyTag


class BusinessSpecialtyTag(models.Model):
    BST_ID = models.AutoField(primary_key=True)
    BST_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BST_UPDATED_AT = models.DateTimeField(auto_now=True)

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column='BUSN_ID',
        related_name='specialty_tag_links'
    )

    TAG_ID = models.ForeignKey(
        SpecialtyTag,
        on_delete=models.PROTECT,
        db_column='TAG_ID',
        related_name='business_links'
    )

    class Meta:
        db_table = 'BUSINESS_SPECIALTY_TAG'
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=['BUSN_ID', 'TAG_ID'],
                name='unique_business_specialty_tag',
            ),
        ]

class BusinessVouch(models.Model):
    """A user's endorsement of a specialty associated with a business."""

    VOUCH_ID = models.AutoField(primary_key=True)

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="vouches",
        db_column="BUSN_ID",
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="business_vouches",
        db_column="USER_ID",
    )

    TAG_ID = models.ForeignKey(
        SpecialtyTag,
        on_delete=models.CASCADE,
        related_name="vouches",
        db_column="TAG_ID",
    )

    VOUCH_FLAG_SUSPICIOUS = models.BooleanField(
        default=False,
    )

    VOUCH_DEVICE_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    VOUCH_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    VOUCH_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "BUSINESS_VOUCH"
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=["BUSN_ID", "USER_ID", "TAG_ID"],
                name="unique_business_user_tag_vouch",
            ),
        ]
