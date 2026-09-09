from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


ZERO = Decimal("0.00")
ONE = Decimal("1.00")


class DiscoveryAlgorithmConfiguration(models.Model):
    """The authoritative configuration for the Discovery Algorithm."""

    DAC_ID = models.PositiveSmallIntegerField(
        primary_key=True,
        default=1,
        editable=False,
    )

    DAC_SPECIALTY_SCORE_WEIGHT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.80"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_VISIBILITY_GAP_WEIGHT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.20"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_DECAY_RATE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.10"),
        validators=[
            MinValueValidator(
                Decimal("0.00001"),
            ),
        ],
    )

    DAC_REPUTATION_BASELINE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.20"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_VOUCH_REPUTATION_REWARD = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.01"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_REVIEW_REPUTATION_REWARD = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.03"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_REVIEW_PHOTO_REPUTATION_REWARD = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.05"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_APPROVED_REPORT_REPUTATION_REWARD = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.02"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.10"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_VOUCH_ONLY_REPUTATION_CAP = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.40"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_MIN_CATEGORY_COMPARISON_SIZE = models.PositiveIntegerField(
        default=5,
        validators=[
            MinValueValidator(1),
        ],
    )

    DAC_MIN_CLUSTER_COMPARISON_SIZE = models.PositiveIntegerField(
        default=5,
        validators=[
            MinValueValidator(1),
        ],
    )

    DAC_VISIBILITY_WINDOW_DAYS = models.PositiveIntegerField(
        default=30,
        validators=[
            MinValueValidator(1),
        ],
    )

    DAC_IMPRESSION_WEIGHT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.60"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_PROFILE_VISIT_WEIGHT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.20"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_SAVE_WEIGHT = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.20"),
        validators=[
            MinValueValidator(ZERO),
            MaxValueValidator(ONE),
        ],
    )

    DAC_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    DAC_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "DISCOVERY_ALGORITHM_CONFIGURATION"
        constraints = [  # noqa: RUF012
            models.CheckConstraint(
                condition=models.Q(
                    DAC_ID=1,
                ),
                name="discovery_algorithm_configuration_singleton",
            ),
        ]

    def clean(self):
        super().clean()

        discovery_weight_total = (
            self.DAC_SPECIALTY_SCORE_WEIGHT
            + self.DAC_VISIBILITY_GAP_WEIGHT
        )

        if discovery_weight_total != ONE:
            raise ValidationError(
                {
                    "DAC_VISIBILITY_GAP_WEIGHT": (
                        "Specialty Score and Visibility Gap weights "
                        "must sum to 1."
                    ),
                },
            )

        visibility_weight_total = (
            self.DAC_IMPRESSION_WEIGHT
            + self.DAC_PROFILE_VISIT_WEIGHT
            + self.DAC_SAVE_WEIGHT
        )

        if visibility_weight_total != ONE:
            raise ValidationError(
                {
                    "DAC_SAVE_WEIGHT": (
                        "Impression, profile visit, and save weights "
                        "must sum to 1."
                    ),
                },
            )

    def __str__(self):
        return "Discovery Algorithm Configuration"
