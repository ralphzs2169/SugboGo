"""Validated activity queries and explicit safe representations for Admin Web consumers."""

import re
from datetime import date

from rest_framework import serializers

from apps.admin_operations.system_configuration.analytics_policy_definitions import (
    POLICY_FIELDS,
)
from apps.users.models import User

from .services import AdminActivityService
from .unified_activity_service import UnifiedActivityService


class UnifiedActivityQuerySerializer(serializers.Serializer):
    """Validate closed filter values and inclusive Philippine calendar-date selections."""

    category = serializers.ChoiceField(
        choices=("all", "administrative", "merchant", "explorer", "authentication"),
        default="all",
    )
    module = serializers.ChoiceField(
        choices=UnifiedActivityService.MODULES,
        required=False,
    )
    action = serializers.ChoiceField(
        choices=UnifiedActivityService.ACTIONS,
        required=False,
    )
    actor_id = serializers.IntegerField(
        min_value=1,
        max_value=9223372036854775807,
        required=False,
    )
    start_date = serializers.DateField(
        input_formats=("%Y-%m-%d",),
        required=False,
    )
    end_date = serializers.DateField(
        input_formats=("%Y-%m-%d",),
        required=False,
    )

    def validate(
        self,
        attrs,
    ):
        """Reject ignored filters, reversed ranges, and dates without a representable exclusive end."""
        unknown = set(self.initial_data) - set(self.fields) - {"page", "page_size"}
        if unknown:
            raise serializers.ValidationError({
                key: "Unsupported activity query parameter."
                for key in sorted(unknown)
            })
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if (
            start_date is not None
            and end_date is not None
            and start_date > end_date
        ):
            raise serializers.ValidationError({
                "end_date": "End date must be on or after start date.",
            })
        if end_date == date.max:
            raise serializers.ValidationError({
                "end_date": "Use an end date before 9999-12-31.",
            })
        return attrs


def safe_state(
    value,
    source_type,
):
    """Publish reviewed state keys with bounded primitive values instead of arbitrary stored JSON."""
    if not isinstance(value, dict):
        return None
    result = {}
    for key, item in value.items():
        if source_type == "analytics_policy_change":
            if (
                key in POLICY_FIELDS
                and type(item) is int
            ):
                result[key] = item
        elif source_type == "admin_activity":
            if key not in AdminActivityService.STATE_FIELDS:
                continue
            if (
                key in ("status", "role", "name")
                and isinstance(item, str)
                and len(item) <= 2000
            ):
                result[key] = item
            elif (
                key in ("category_id", "cluster_id")
                and type(item) is int
                and item > 0
            ):
                result[key] = item
            elif (
                key == "is_active"
                and type(item) is bool
            ):
                result[key] = item
            elif (
                key == "specialty_tag_ids"
                and isinstance(item, list)
                and len(item) <= 100
                and all(
                    type(identifier) is int
                    and identifier > 0
                    for identifier in item
                )
            ):
                result[key] = item
        elif (
            key in ("status", "closure_reason")
            and isinstance(item, str)
            and len(item) <= 64
        ):
            result[key] = item
    return result


class CurrentActivityActorSerializer(serializers.ModelSerializer):
    """Expose minimal current account identity separately from recorded activity snapshots."""

    name = serializers.CharField(
        source="full_name",
        read_only=True,
    )
    role = serializers.CharField(
        source="USER_ROLE",
        read_only=True,
    )
    avatar_url = serializers.ReadOnlyField()
    avatar_key = serializers.CharField(
        source="USER_AVATAR_KEY",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "name",
            "role",
            "avatar_url",
            "avatar_key",
        )


class UnifiedActivitySerializer(serializers.Serializer):
    """Expose normalized facts with safe provenance and separately resolved current actor identity."""

    id = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    source_type = serializers.CharField()
    source_id = serializers.CharField()
    occurrence = serializers.CharField(allow_null=True)
    module = serializers.CharField(allow_null=True)
    occurred_at = serializers.DateTimeField()
    actor_id = serializers.IntegerField(allow_null=True)
    actor_display_snapshot = serializers.CharField(allow_null=True)
    actor_role_snapshot = serializers.CharField(allow_null=True)
    current_actor = serializers.SerializerMethodField()
    target_type = serializers.CharField(allow_null=True)
    target_id = serializers.CharField(allow_null=True)
    target_label = serializers.CharField(allow_null=True)
    outcome = serializers.CharField(allow_null=True)
    new_state = serializers.SerializerMethodField()
    is_administrative = serializers.BooleanField(allow_null=True)
    provenance = serializers.JSONField()

    def get_current_actor(
        self,
        obj,
    ):
        """Serialize an already batched user lookup without issuing per-event database queries."""
        actor = self.context.get("current_actors", {}).get(obj["actor_id"])
        if actor is None:
            return None
        return CurrentActivityActorSerializer(actor).data

    def get_id(
        self,
        obj,
    ):
        """Return the source-type, source-ID, occurrence composite identity."""
        return UnifiedActivityService.event_identity(obj)

    def get_category(
        self,
        obj,
    ):
        """Keep source categories independent of historical or current account roles."""
        return UnifiedActivityService.category_for(obj)

    def get_new_state(
        self,
        obj,
    ):
        """Filter stored states even when legacy rows bypassed modern writer validation."""
        return safe_state(
            obj["new_state"],
            obj["source_type"],
        )


class UnifiedActivityDetailSerializer(UnifiedActivitySerializer):
    """Add available decision details while omitting private evidence and unrestricted legacy context."""

    previous_state = serializers.SerializerMethodField()
    reason = serializers.SerializerMethodField()
    context = serializers.SerializerMethodField()

    def get_previous_state(
        self,
        obj,
    ):
        """Use the same state allowlist for historical before values."""
        return safe_state(
            obj["previous_state"],
            obj["source_type"],
        )

    def get_reason(
        self,
        obj,
    ):
        """Return bounded decision text only, never stringify JSON evidence as a reason."""
        value = obj["reason"]
        if (
            isinstance(value, str)
            and len(value) <= 2000
        ):
            return value
        return None

    def get_context(
        self,
        obj,
    ):
        """Disclose only typed record references, counts, and decision codes from legacy context."""
        context = obj["context"]
        if not isinstance(context, dict):
            return None
        result = {}
        for key in (
            "application_id",
            "submission_id",
            "business_id",
            "review_id",
            "report_id",
            "dispute_id",
            "request_id",
            "previous_transition_id",
            "report_count",
        ):
            value = context.get(key)
            if (
                type(value) is int
                and value >= 0
            ):
                result[key] = value
        report_ids = context.get("report_ids")
        if (
            isinstance(report_ids, list)
            and len(report_ids) <= 100
            and all(
                type(value) is int
                and value > 0
                for value in report_ids
            )
        ):
            result["report_ids"] = report_ids
        for key in ("request_type", "decision"):
            value = context.get(key)
            if (
                isinstance(value, str)
                and re.fullmatch(r"[a-z][a-z0-9_]{0,63}", value)
            ):
                result[key] = value
        return result
