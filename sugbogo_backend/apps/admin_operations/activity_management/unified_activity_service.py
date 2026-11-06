"""Typed read projections over authoritative activity sources without copying their records."""

from django.db.models import (
    BigIntegerField,
    BooleanField,
    Case,
    CharField,
    DateTimeField,
    F,
    JSONField,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce, JSONObject

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.merchant_application.models import MerchantApplicationSubmission


class UnifiedActivityService:
    """Expose an unscoped, lazy activity queryset for future permission-controlled consumers."""

    # Snapshot fields never fall back to current account identity or target labels.
    COLUMNS = (
        "source_type",
        "source_id",
        "occurrence",
        "module",
        "occurred_at",
        "actor_id",
        "actor_display_snapshot",
        "actor_role_snapshot",
        "target_type",
        "target_id",
        "target_label",
        "outcome",
        "new_state",
        "is_administrative",
        "provenance",
    )

    @classmethod
    def _project(
        cls,
        queryset,
        source_type,
        id_field,
        timestamp_field,
        **details,
    ):
        """Project the same typed columns and source identity before combining querysets."""
        annotations = {
            "source_type": Value(source_type, output_field=CharField()),
            "source_id": Cast(F(id_field), output_field=CharField()),
            "occurrence": Cast(Value(None), output_field=CharField()),
            "module": Cast(Value(None), output_field=CharField()),
            "occurred_at": Cast(F(timestamp_field), output_field=DateTimeField()),
            "actor_id": Cast(Value(None), output_field=BigIntegerField()),
            "actor_display_snapshot": Cast(Value(None), output_field=CharField()),
            "actor_role_snapshot": Cast(Value(None), output_field=CharField()),
            "target_type": Cast(Value(None), output_field=CharField()),
            "target_id": Cast(Value(None), output_field=CharField()),
            "target_label": Cast(Value(None), output_field=CharField()),
            "outcome": Cast(Value(None), output_field=CharField()),
            # Explicit JSON NULL keeps PostgreSQL from resolving missing branches as text.
            "new_state": Cast(Value(None), output_field=JSONField()),
            "is_administrative": Cast(Value(None), output_field=BooleanField()),
            "provenance": JSONObject(
                model=Value(queryset.model._meta.label_lower),
            ),
        }
        annotations.update(details)
        return (
            queryset
            .order_by()
            .annotate(**annotations)
            .values(*cls.COLUMNS)
        )

    @classmethod
    def _admin_activities(cls):
        """Preserve stored snapshots and Task 1's explicit and legacy classification rules."""
        action_modules = AdminActivity.administrative_action_modules()
        return cls._project(
            AdminActivity.objects.all(),
            "admin_activity",
            "AACT_ID",
            "AACT_CREATED_AT",
            occurrence=F("AACT_ACTION"),
            module=Coalesce(
                "AACT_MODULE",
                Case(
                    *[
                        When(
                            AACT_ACTION=action,
                            then=Value(module),
                        )
                        for action, module in action_modules.items()
                    ],
                    default=Value(None),
                    output_field=CharField(),
                ),
                output_field=CharField(),
            ),
            actor_id=Cast("ACTOR_ID_id", output_field=BigIntegerField()),
            actor_display_snapshot=F("AACT_ACTOR_NAME"),
            actor_role_snapshot=F("AACT_ACTOR_ROLE"),
            # TARGET_USER_ID can be a related author or owner rather than the affected entity.
            target_type=F("AACT_TARGET_TYPE"),
            target_id=F("AACT_TARGET_ID"),
            target_label=F("AACT_TARGET_LABEL"),
            outcome=F("AACT_OUTCOME"),
            new_state=F("AACT_NEW_STATE"),
            is_administrative=Case(
                When(
                    AACT_IS_ADMINISTRATIVE__isnull=False,
                    then=F("AACT_IS_ADMINISTRATIVE"),
                ),
                When(
                    AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
                    then=Value(False),
                ),
                When(
                    AACT_ACTION__in=tuple(action_modules),
                    then=Value(True),
                ),
                default=Value(None),
                output_field=BooleanField(),
            ),
            provenance=JSONObject(
                model=Value(AdminActivity._meta.label_lower),
                domain_source_type=F("AACT_SOURCE_TYPE"),
                domain_source_id=F("AACT_SOURCE_ID"),
            ),
        )

    @classmethod
    def _policy_changes(cls):
        """Represent each retained singleton policy revision without inventing its actor's role."""
        return cls._project(
            AnalyticsPolicyChange.objects.all(),
            "analytics_policy_change",
            "APCH_ID",
            "APCH_CREATED_AT",
            occurrence=Value("analytics_policy_revision", output_field=CharField()),
            module=Value("system_configuration", output_field=CharField()),
            actor_id=Coalesce(
                Cast("APCH_ACTOR_ID_SNAPSHOT", output_field=BigIntegerField()),
                Cast("APCH_ACTOR_id", output_field=BigIntegerField()),
                output_field=BigIntegerField(),
            ),
            target_type=Value("analytics_policy", output_field=CharField()),
            target_id=Value("1", output_field=CharField()),
            new_state=F("APCH_AFTER"),
            is_administrative=Value(True, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(AnalyticsPolicyChange._meta.label_lower),
                version=F("APCH_VERSION"),
            ),
        )

    @classmethod
    def _application_submissions(cls):
        """Read each submission receipt independently of the application's subsequent status."""
        return cls._project(
            MerchantApplicationSubmission.objects.all(),
            "merchant_application_submission",
            "MASUB_ID",
            "MASUB_SUBMITTED_AT",
            occurrence=Value("merchant_application_submitted", output_field=CharField()),
            module=Value(AdminActivity.Module.MERCHANT_APPLICATION, output_field=CharField()),
            actor_id=Cast("MAPP_ID__USER_ID_id", output_field=BigIntegerField()),
            target_type=Value("merchant_application", output_field=CharField()),
            target_id=Cast("MAPP_ID_id", output_field=CharField()),
            is_administrative=Value(False, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(MerchantApplicationSubmission._meta.label_lower),
                submission_number=F("MASUB_SUBMISSION_NUMBER"),
            ),
        )

    @classmethod
    def list_activity(cls):
        """Combine all three sources in SQL and leave slicing/counting to the caller's paginator."""
        return (
            cls._admin_activities()
            .union(
                cls._policy_changes(),
                cls._application_submissions(),
                all=True,
            )
            .order_by(
                "-occurred_at",
                "source_type",
                "source_id",
                "occurrence",
            )
        )
