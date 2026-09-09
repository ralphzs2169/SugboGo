
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.users.models import User

from .business_core_models import Business
from .business_taxonomy_models import SpecialtyTag


class BusinessSpecialtyTag(models.Model):
    """A specialty tag associated with a business."""
    
    BST_ID = models.AutoField(primary_key=True)
    BST_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BST_UPDATED_AT = models.DateTimeField(auto_now=True)

    BST_VOUCH_COUNT = models.PositiveIntegerField(
        default=0,
    )

    BST_TAG_SCORE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.00000"),
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )

    BST_SCORE_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )

    BST_IS_ACTIVE = models.BooleanField(
        default=True,
    )

    BST_ACTIVATED_AT = models.DateTimeField(
        default=timezone.now,
    )

    BST_DEACTIVATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )

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
            models.CheckConstraint(
                condition=(
                    models.Q(
                        BST_TAG_SCORE__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        BST_TAG_SCORE__lte=Decimal("1.00"),
                    )
                ),
                name="business_specialty_tag_score_in_range",
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

    VOUCH_REPUTATION_SNAPSHOT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        editable=False,
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )

    VOUCH_EVIDENCE_IS_VALID = models.BooleanField(
        default=True,
    )

    VOUCH_EVIDENCE_INVALIDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
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
            models.CheckConstraint(
                condition=(
                    models.Q(
                        VOUCH_REPUTATION_SNAPSHOT__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        VOUCH_REPUTATION_SNAPSHOT__lte=Decimal("1.00"),
                    )
                ),
                name="vouch_reputation_snapshot_in_range",
            ),
        ]
