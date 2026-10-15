"""Read-only policy resolution and atomic, authorized configuration changes."""

from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Mapping

from django.db import DatabaseError, transaction
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.authentication.permissions import user_has_role
from apps.users.models import User

from ..analytics_policy_definitions import POLICY_FIELDS
from ..models import AnalyticsPolicyChange, AnalyticsPolicyConfiguration


class AnalyticsPolicyUnavailable(APIException):
    """Fail closed when the authoritative policy cannot be read or validated."""

    status_code = 503
    default_detail = "Analytics policy is unavailable."
    default_code = "ANALYTICS_POLICY_UNAVAILABLE"


class AnalyticsPolicyConflict(APIException):
    """Prevent an outdated settings form from overwriting a newer revision."""

    status_code = 409
    default_detail = "Analytics policy changed. Reload the settings before saving."
    default_code = "ANALYTICS_POLICY_VERSION_CONFLICT"


@dataclass(frozen=True)
class AnalyticsPolicySnapshot:
    """Expose immutable rule values from one authoritative read."""

    version: int
    values: Mapping[str, int]
    updated_at: datetime

    def __getitem__(self, name):
        """Retrieve one public policy value by its established name."""
        return self.values[name]

    @property
    def review_rules(self):
        """Describe only rules affecting generated narrative and mention content."""
        return {name: self.values[name] for name in ("narrative_min_eligible_reviews", "mention_min_supporting_reviews")}


class AnalyticsPolicyService:
    """Keep interpretation policy independent of scoring, entitlements, and tracking coverage."""

    @staticmethod
    def values(configuration):
        """Translate persisted fields into stable frontend and consumer names."""
        return {name: getattr(configuration, spec.model_field) for name, spec in POLICY_FIELDS.items()}

    @staticmethod
    def validate_values(values):
        """Reject unknown rules, coercions, and values outside server-owned bounds."""
        if not isinstance(values, dict) or not values:
            raise ValidationError({"values": "Provide at least one policy setting."})
        errors = {}
        for name, value in values.items():
            spec = POLICY_FIELDS.get(name)
            if spec is None:
                errors[name] = "Unknown or non-editable policy setting."
            elif type(value) is not int or not spec.minimum <= value <= spec.maximum:
                errors[name] = f"Use an integer from {spec.minimum} to {spec.maximum}."
        if errors:
            raise ValidationError({"values": errors})

    @classmethod
    def read(cls):
        """Read the seeded policy without creating rows or falling back to weaker defaults."""
        try:
            configuration = AnalyticsPolicyConfiguration.objects.get(pk=1)
        except (AnalyticsPolicyConfiguration.DoesNotExist, DatabaseError):
            raise AnalyticsPolicyUnavailable() from None
        return cls.snapshot(configuration)

    @classmethod
    def snapshot(cls, configuration):
        """Validate one model revision and freeze its public values without another query."""
        values = cls.values(configuration)
        try:
            cls.validate_values(values)
        except ValidationError:
            raise AnalyticsPolicyUnavailable() from None
        if configuration.APC_VERSION < 1:
            raise AnalyticsPolicyUnavailable()
        return AnalyticsPolicySnapshot(configuration.APC_VERSION, MappingProxyType(values), configuration.APC_UPDATED_AT)

    @classmethod
    @transaction.atomic
    def update(cls, *, actor, expected_version, reason, values):
        """Lock the singleton and publish one audited revision for a genuine settings change."""
        if not actor or not actor.is_authenticated or not actor.is_active or not user_has_role(actor, User.UserRole.SUPER_ADMIN):
            raise PermissionDenied("Only active Super Admins can update analytics policy.")
        if type(expected_version) is not int or expected_version < 1:
            raise ValidationError({"expected_version": "Provide a positive integer version."})
        if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 1000:
            raise ValidationError({"reason": "Provide a change reason of at most 1000 characters."})
        cls.validate_values(values)
        try:
            configuration = AnalyticsPolicyConfiguration.objects.select_for_update().get(pk=1)
        except (AnalyticsPolicyConfiguration.DoesNotExist, DatabaseError):
            raise AnalyticsPolicyUnavailable() from None
        if configuration.APC_VERSION != expected_version:
            raise AnalyticsPolicyConflict()
        before = cls.values(configuration)
        after = {**before, **values}
        cls.validate_values(after)
        if before == after:
            return configuration, False
        for name, value in values.items():
            setattr(configuration, POLICY_FIELDS[name].model_field, value)
        configuration.APC_VERSION += 1
        configuration.APC_UPDATED_BY = actor
        configuration.full_clean()
        configuration.save()
        AnalyticsPolicyChange.objects.create(
            APCH_VERSION=configuration.APC_VERSION, APCH_ACTOR=actor, APCH_ACTOR_ID_SNAPSHOT=actor.pk,
            APCH_REASON=reason.strip(), APCH_BEFORE=before, APCH_AFTER=after,
        )
        return configuration, True

    @staticmethod
    def history():
        """Return revision-ordered audit rows for the authorized paginated endpoint."""
        return AnalyticsPolicyChange.objects.order_by("-APCH_VERSION")
