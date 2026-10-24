from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .business_location_models import Location
from .business_taxonomy_models import Category, SpecialtyTag


class Business(models.Model):
    class BusinessStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    BUSN_ID = models.AutoField(primary_key=True)

    BUSN_NAME = models.CharField(
        max_length=150,
    )

    BUSN_DESCRIPTION = models.TextField(
        blank=True,
        null=True,
    )

    BUSN_ACCESS_DIRECTIONS = models.TextField(
        max_length=1000,
        blank=True,
        default="",
    )

    BUSN_CONTACT_NUMBER = models.CharField(
        max_length=20,
    )

    BUSN_EMAIL = models.EmailField(
        blank=True,
        null=True,
    )

    BUSN_WEBSITE = models.URLField(
        blank=True,
        null=True,
    )

    BUSN_STATUS = models.CharField(
        max_length=20,
        choices=BusinessStatus.choices,
        default=BusinessStatus.ACTIVE,
    )

    BUSN_IS_VERIFIED = models.BooleanField(
        default=False,
    )

    BUSN_VOUCH_COUNT = models.PositiveIntegerField(
        default=0,
    )

    BUSN_REVIEW_COUNT = models.PositiveIntegerField(
        default=0,
    )

    BUSN_POCKET_COUNT = models.PositiveIntegerField(
        default=0,
    )

    BUSN_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    BUSN_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    USER_ID = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="owned_business",
    )

    CTGRY_ID = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        db_column="CTGRY_ID",
        related_name="businesses",
    )

    LOCT_ID = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        db_column="LOCT_ID",
        related_name="businesses",
    )

    SPECIALTY_TAGS = models.ManyToManyField(
        SpecialtyTag,
        related_name="businesses",
        through="BusinessSpecialtyTag",
        blank=True,
    )

    BUSN_COVER_PHOTO_URL = models.URLField(
        blank=True,
        null=True,
    )

    BUSN_COVER_PHOTO_PUBLIC_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "BUSINESS"

    def __str__(self):
        return self.BUSN_NAME


class DiscoveryScore(models.Model):
    """Stores current discovery values and their initialization/refresh provenance."""

    DSC_ID = models.AutoField(primary_key=True)
    DSC_S_SCORE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )
    DSC_V_SCORE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )
    DSC_D_SCORE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )
    DSC_COMPUTED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    DSC_IS_PROVISIONAL = models.BooleanField(
        default=False,
    )
    DSC_REFRESH_VERSION = models.PositiveBigIntegerField(
        default=0,
    )
    DSC_REFRESH_REQUESTED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    DSC_LAST_ATTEMPT_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    DSC_LAST_ERROR = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )
    DSC_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )
    DSC_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    BUSN_ID = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="discovery_score",
    )

    class Meta:
        db_table = "DISCOVERY_SCORE"
        constraints = [  # noqa: RUF012
            models.CheckConstraint(
                condition=(
                    models.Q(
                        DSC_S_SCORE__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        DSC_S_SCORE__lte=Decimal("1.00"),
                    )
                ),
                name="discovery_specialty_score_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        DSC_V_SCORE__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        DSC_V_SCORE__lte=Decimal("1.00"),
                    )
                ),
                name="discovery_visibility_gap_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        DSC_D_SCORE__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        DSC_D_SCORE__lte=Decimal("1.00"),
                    )
                ),
                name="discovery_score_in_range",
            ),
        ]
