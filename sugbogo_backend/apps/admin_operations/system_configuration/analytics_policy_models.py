"""Persist analytics interpretation policy separately from ranking algorithm configuration."""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .analytics_policy_definitions import POLICY_FIELDS


class AnalyticsPolicyConfiguration(models.Model):
    """Hold one versioned analytics policy without changing discovery or recommendation scores."""

    APC_ID = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    APC_VERSION = models.PositiveBigIntegerField(default=1, editable=False)
    APC_UPDATED_BY = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="analytics_policy_updates")
    APC_UPDATED_AT = models.DateTimeField(auto_now=True)

    # A single definition map keeps schema validators aligned with the published API ranges.
    for _spec in POLICY_FIELDS.values():
        locals()[_spec.model_field] = models.PositiveIntegerField(
            default=_spec.default,
            validators=[MinValueValidator(_spec.minimum), MaxValueValidator(_spec.maximum)],
        )
    del _spec

    class Meta:
        db_table = "ANALYTICS_POLICY_CONFIGURATION"
        constraints = [
            models.CheckConstraint(condition=models.Q(APC_ID=1), name="analytics_policy_singleton"),
            models.CheckConstraint(condition=models.Q(APC_VERSION__gte=1), name="analytics_policy_positive_version"),
            *[models.CheckConstraint(
                condition=models.Q(**{f"{spec.model_field}__gte": spec.minimum, f"{spec.model_field}__lte": spec.maximum}),
                name=f"analytics_policy_{name}_range",
            ) for name, spec in POLICY_FIELDS.items()],
        ]


class AnalyticsPolicyChange(models.Model):
    """Retain an API-immutable policy revision record with its old and new values."""

    APCH_ID = models.BigAutoField(primary_key=True)
    APCH_VERSION = models.PositiveBigIntegerField(unique=True)
    APCH_ACTOR = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="analytics_policy_changes")
    APCH_ACTOR_ID_SNAPSHOT = models.PositiveBigIntegerField(null=True, blank=True)
    APCH_REASON = models.CharField(max_length=1000)
    APCH_BEFORE = models.JSONField(default=dict)
    APCH_AFTER = models.JSONField()
    APCH_CREATED_AT = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ANALYTICS_POLICY_CHANGE"
        ordering = ("-APCH_VERSION",)
