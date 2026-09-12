from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "system_configuration",
            "0003_remove_discovery_confidence_fields",
        ),
    ]

    operations = [
        migrations.CreateModel(
            name="RecommendationAlgorithmConfiguration",
            fields=[
                (
                    "RAC_ID",
                    models.PositiveSmallIntegerField(
                        default=1,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "RAC_CLUSTER_WEIGHT",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("1.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00001"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_CATEGORY_WEIGHT",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("2.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00001"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_SPECIALTY_TAG_WEIGHT",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("3.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00001"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_PROFILE_VISIT_STRENGTH",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("1.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_POCKET_STRENGTH",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("3.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_SPECIALTY_VOUCH_STRENGTH",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("3.00000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_HIGH_MATCH_THRESHOLD",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("0.70000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00"),
                            ),
                            django.core.validators.MaxValueValidator(
                                Decimal("1.00"),
                            ),
                        ],
                    ),
                ),
                (
                    "RAC_MODERATE_MATCH_THRESHOLD",
                    models.DecimalField(
                        decimal_places=5,
                        default=Decimal("0.40000"),
                        max_digits=6,
                        validators=[
                            django.core.validators.MinValueValidator(
                                Decimal("0.00001"),
                            ),
                            django.core.validators.MaxValueValidator(
                                Decimal("1.00"),
                            ),
                        ],
                    ),
                ),
                ("RAC_CREATED_AT", models.DateTimeField(auto_now_add=True)),
                ("RAC_UPDATED_AT", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "RECOMMENDATION_ALGORITHM_CONFIGURATION",
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("RAC_ID", 1)),
                        name="recommendation_algorithm_configuration_singleton",
                    ),
                ],
            },
        ),
    ]
