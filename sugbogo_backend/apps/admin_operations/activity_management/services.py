import math
import re
from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.users.models import User


class AdminActivityService:
    """Creates and queries administrative and moderation history involving users."""

    # Extend these explicit fields alongside reviewed workflow integrations;
    # never supply model dictionaries, request bodies, or raw provider evidence.
    STATE_FIELDS = frozenset({
        "status",
        "role",
        "is_active",
        "name",
        "category_id",
        "cluster_id",
        "specialty_tag_ids",
    })
    CONTEXT_FIELDS = frozenset({
        "application_id",
        "submission_id",
        "business_id",
        "review_id",
        "report_id",
        "report_ids",
        "report_count",
        "dispute_id",
        "request_id",
        "request_type",
        "candidate_key",
        "decision",
        "previous_transition_id",
    })

    @staticmethod
    def _validate_name(
        value,
        field,
    ):
        """Require a bounded snake_case entity or source namespace."""
        if (
            not isinstance(value, str)
            or len(value) > 64
            or re.fullmatch(r"[a-z][a-z0-9_]*", value) is None
        ):
            raise ValidationError({
                field: "Use a snake_case name of at most 64 characters.",
            })
        return value

    @staticmethod
    def _normalize_identifier(
        value,
        field,
    ):
        """Canonicalize positive integer and UUID record identities without retaining live relations."""
        if (
            type(value) is int
            and value > 0
        ):
            normalized = str(value)
        elif isinstance(value, UUID):
            normalized = str(value)
        elif isinstance(value, str):
            if re.fullmatch(r"[0-9]+", value):
                if (
                    len(value) > 64
                    or int(value) <= 0
                ):
                    raise ValidationError({
                        field: "Use a positive integer or UUID record identifier.",
                    })
                normalized = str(int(value))
            else:
                try:
                    normalized = str(UUID(value))
                except ValueError:
                    raise ValidationError({
                        field: "Use a positive integer or UUID record identifier.",
                    }) from None
        else:
            raise ValidationError({
                field: "Use a positive integer or UUID record identifier.",
            })
        if len(normalized) > 64:
            raise ValidationError({
                field: "Use a record identifier of at most 64 characters.",
            })
        return normalized

    @staticmethod
    def _validate_text(
        value,
        field,
        max_length,
    ):
        """Retain optional bounded descriptive text without serializing related objects."""
        if value is None:
            return None
        if (
            not isinstance(value, str)
            or len(value) > max_length
        ):
            raise ValidationError({
                field: f"Use text of at most {max_length} characters.",
            })
        value = value.strip()
        if not value:
            return None
        return value

    @staticmethod
    def _validate_safe_value(
        value,
        field,
    ):
        """Allow bounded JSON scalars and scalar lists while rejecting arbitrary nested payloads."""
        if (
            value is None
            or type(value) in (bool, int)
        ):
            return
        if (
            isinstance(value, str)
            and len(value) <= 2000
        ):
            return
        if (
            type(value) is float
            and math.isfinite(value)
        ):
            return
        raise ValidationError({
            field: "Use only bounded JSON scalars or lists of scalars.",
        })

    @classmethod
    def _validate_payload(
        cls,
        value,
        field,
        allowed_fields,
    ):
        """Accept only reviewed context keys and reject sensitive or unrestricted payload structures."""
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValidationError({
                field: "Use an object containing only allowed event fields.",
            })
        if set(value) - allowed_fields:
            raise ValidationError({
                field: "The event contains fields that are not allowed.",
            })
        for item in value.values():
            if isinstance(item, list):
                if len(item) > 100:
                    raise ValidationError({
                        field: "Use lists of at most 100 scalars.",
                    })
                for child in item:
                    cls._validate_safe_value(
                        child,
                        field,
                    )
            else:
                cls._validate_safe_value(
                    item,
                    field,
                )
        return value

    @classmethod
    def record_event(
        cls,
        *,
        actor: User,
        action: str,
        module: str,
        target_type: str,
        target_id,
        target_label: str | None = None,
        target_user: User | None = None,
        previous_state: dict | None = None,
        new_state: dict | None = None,
        reason: str | None = None,
        outcome: str = AdminActivity.Outcome.SUCCEEDED,
        context: dict | None = None,
        source_type: str | None = None,
        source_id=None,
    ) -> AdminActivity:
        """Record an administrative event inside the caller's transaction, reusing identical source events."""
        if not transaction.get_connection().in_atomic_block:
            raise ValidationError(
                "Record administrative events inside the operation's database transaction.",
            )
        if (
            not isinstance(actor, User)
            or actor.pk is None
        ):
            raise ValidationError({
                "actor": "Use a persisted administrator account.",
            })
        if (
            not actor.is_active
            or actor.USER_ROLE not in (
                User.UserRole.ADMIN,
                User.UserRole.SUPER_ADMIN,
            )
        ):
            raise PermissionDenied(
                "Only active administrators can record administrative events.",
            )

        # Register new workflow actions here through the model's explicit taxonomy.
        action_modules = AdminActivity.administrative_action_modules()
        if (
            not isinstance(action, str)
            or action not in action_modules
        ):
            raise ValidationError({
                "action": "Use a registered administrative action.",
            })
        if module != action_modules[action]:
            raise ValidationError({
                "module": "Use the registered module for this action.",
            })
        if outcome not in AdminActivity.Outcome.values:
            raise ValidationError({
                "outcome": "Use succeeded or accepted; decision results belong in the action or state.",
            })

        target_type = cls._validate_name(
            target_type,
            "target_type",
        )
        target_id = cls._normalize_identifier(
            target_id,
            "target_id",
        )
        target_user_id = None
        if target_user is not None:
            if (
                not isinstance(target_user, User)
                or target_user.pk is None
            ):
                raise ValidationError({
                    "target_user": "Use a persisted related user account.",
                })
            target_user_id = target_user.pk
            if (
                target_type == "user"
                and target_id != str(target_user_id)
            ):
                raise ValidationError({
                    "target_user": "The related user must match the user target.",
                })

        if (source_type is None) != (source_id is None):
            raise ValidationError(
                "Provide both source_type and source_id, or omit both.",
            )
        if source_type is not None:
            source_type = cls._validate_name(
                source_type,
                "source_type",
            )
            source_id = cls._normalize_identifier(
                source_id,
                "source_id",
            )

        context = cls._validate_payload(
            context,
            "context",
            cls.CONTEXT_FIELDS,
        )
        if context is None:
            context = {}
        values = {
            "ACTOR_ID_id": actor.pk,
            "TARGET_USER_ID_id": target_user_id,
            "AACT_ACTION": action,
            "AACT_MODULE": module,
            "AACT_IS_ADMINISTRATIVE": True,
            "AACT_TARGET_TYPE": target_type,
            "AACT_TARGET_ID": target_id,
            "AACT_TARGET_LABEL": cls._validate_text(
                target_label,
                "target_label",
                255,
            ),
            "AACT_ACTOR_NAME": actor.full_name or None,
            "AACT_ACTOR_ROLE": actor.USER_ROLE,
            "AACT_PREVIOUS_STATE": cls._validate_payload(
                previous_state,
                "previous_state",
                cls.STATE_FIELDS,
            ),
            "AACT_NEW_STATE": cls._validate_payload(
                new_state,
                "new_state",
                cls.STATE_FIELDS,
            ),
            "AACT_REASON": cls._validate_text(
                reason,
                "reason",
                2000,
            ),
            "AACT_OUTCOME": outcome,
            "AACT_CONTEXT": context,
        }
        if source_type is None:
            return AdminActivity.objects.create(**values)

        event, created = AdminActivity.objects.get_or_create(
            AACT_SOURCE_TYPE=source_type,
            AACT_SOURCE_ID=source_id,
            defaults=values,
        )
        if not created:
            # A retry retains original descriptive snapshots even after labels change.
            snapshot_fields = {
                "AACT_ACTOR_NAME",
                "AACT_ACTOR_ROLE",
                "AACT_TARGET_LABEL",
            }
            for field, value in values.items():
                if (
                    field not in snapshot_fields
                    and getattr(event, field) != value
                ):
                    raise ValidationError(
                        "This source record already identifies a different administrative event.",
                    )
        return event

    @staticmethod
    def record_user_action(
        *,
        actor: User,
        target_user: User,
        action: str,
        context: dict | None = None,
    ) -> AdminActivity:
        """Persist an audited action with the actual acting user and target."""
        return AdminActivity.objects.create(
            ACTOR_ID=actor,
            TARGET_USER_ID=target_user,
            AACT_ACTION=action,
            AACT_CONTEXT=context or {},
        )

    @staticmethod
    def list_for_user(user: User):
        """Return newest-first administrative and moderation history for a user."""
        return (
            AdminActivity.objects
            .filter(
                TARGET_USER_ID=user,
            )
            .select_related(
                "ACTOR_ID",
            )
            .order_by(
                "-AACT_CREATED_AT",
                "-AACT_ID",
            )
        )
