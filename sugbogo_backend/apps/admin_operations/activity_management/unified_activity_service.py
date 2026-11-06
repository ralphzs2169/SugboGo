"""Typed read projections over authoritative activity sources without copying their records."""

from django.db.models import (
    BigIntegerField,
    BooleanField,
    Case,
    CharField,
    DateTimeField,
    Exists,
    F,
    JSONField,
    OuterRef,
    Value,
    When,
)
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce, JSONObject, NullIf

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.merchant_application.models import MerchantApplicationSubmission
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute


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

    @staticmethod
    def _recorded_resolution(
        id_field,
        status_field,
        action_statuses,
        context_id_key,
        request_type=None,
    ):
        """Prefer an existing decision audit entry over a second occurrence from its domain receipt."""
        activities = AdminActivity.objects.filter(
            AACT_ACTION__in=tuple(action_statuses),
        )
        if request_type is not None:
            activities = activities.filter(
                AACT_CONTEXT__request_type=request_type,
            )
        return Exists(
            activities
            .annotate(
                recorded_target_id=KeyTextTransform(context_id_key, "AACT_CONTEXT"),
                recorded_status=Case(
                    *[
                        When(
                            AACT_ACTION=action,
                            then=Value(status),
                        )
                        for action, status in action_statuses.items()
                    ],
                    output_field=CharField(),
                ),
            )
            .filter(
                recorded_target_id=Cast(OuterRef(id_field), output_field=CharField()),
                recorded_status=OuterRef(status_field),
            ),
        )

    @classmethod
    def _change_requests(
        cls,
        model,
        prefix,
        request_type,
        action_statuses,
    ):
        """Project submission and retained terminal decisions as distinct request occurrences."""
        source_type = f"{request_type}_request"
        id_field = f"{prefix}_ID"
        status_field = f"{prefix}_STATUS"
        resolved_field = f"{prefix}_RESOLVED_AT"
        queryset = model.objects.all()
        terminal = queryset.filter(**{f"{resolved_field}__isnull": False})
        common = {
            "module": Value(AdminActivity.Module.BUSINESS, output_field=CharField()),
            "target_type": Value(source_type, output_field=CharField()),
            "target_id": Cast(id_field, output_field=CharField()),
            "provenance": JSONObject(
                model=Value(model._meta.label_lower),
                business_id=F("BUSN_ID_id"),
                requester_id=F("USER_ID_id"),
            ),
        }
        submitted = cls._project(
            queryset,
            source_type,
            id_field,
            f"{prefix}_SUBMITTED_AT",
            occurrence=Value(f"{source_type}_submitted", output_field=CharField()),
            actor_id=Cast("USER_ID_id", output_field=BigIntegerField()),
            is_administrative=Value(False, output_field=BooleanField()),
            **common,
        )
        withdrawn = cls._project(
            terminal.filter(**{status_field: "withdrawn"}),
            source_type,
            id_field,
            resolved_field,
            occurrence=Value(f"{source_type}_withdrawn", output_field=CharField()),
            actor_id=Cast("USER_ID_id", output_field=BigIntegerField()),
            new_state=JSONObject(status=F(status_field)),
            is_administrative=Value(False, output_field=BooleanField()),
            **common,
        )
        resolved = cls._project(
            terminal
            .filter(**{f"{status_field}__in": tuple(action_statuses.values())})
            .filter(
                ~cls._recorded_resolution(
                    id_field,
                    status_field,
                    action_statuses,
                    "request_id",
                    request_type=request_type,
                ),
            ),
            source_type,
            id_field,
            resolved_field,
            occurrence=Case(
                *[
                    When(
                        **{status_field: status},
                        then=Value(action),
                    )
                    for action, status in action_statuses.items()
                ],
                output_field=CharField(),
            ),
            actor_id=Cast("REVIEWER_ID_id", output_field=BigIntegerField()),
            new_state=JSONObject(status=F(status_field)),
            is_administrative=Value(True, output_field=BooleanField()),
            **common,
        )
        return submitted, withdrawn, resolved

    @classmethod
    def _review_disputes(cls):
        """Keep merchant filing and withdrawal separate from administrative decisions and automatic closure."""
        source_type = "merchant_review_dispute"
        queryset = MerchantReviewDispute.objects.all()
        terminal = queryset.filter(MRDSP_RESOLVED_AT__isnull=False)
        merchant_id = Coalesce(
            NullIf(
                Cast("MRDSP_ORIGINAL_MERCHANT_ID", output_field=BigIntegerField()),
                Value(0, output_field=BigIntegerField()),
            ),
            Cast("USER_ID_id", output_field=BigIntegerField()),
            output_field=BigIntegerField(),
        )
        action_statuses = {
            AdminActivity.Action.REVIEW_DISPUTE_UPHELD: MerchantReviewDispute.DisputeStatus.UPHELD,
            AdminActivity.Action.REVIEW_DISPUTE_DISMISSED: MerchantReviewDispute.DisputeStatus.DISMISSED,
        }
        common = {
            "module": Value(AdminActivity.Module.REVIEW_MODERATION, output_field=CharField()),
            "target_type": Value(source_type, output_field=CharField()),
            "target_id": Cast("MRDSP_ID", output_field=CharField()),
            "provenance": JSONObject(
                model=Value(MerchantReviewDispute._meta.label_lower),
                business_id=F("MRDSP_ORIGINAL_BUSINESS_ID"),
                review_id=F("MRDSP_ORIGINAL_REVIEW_ID"),
                requester_id=merchant_id,
            ),
        }
        filed = cls._project(
            queryset,
            source_type,
            "MRDSP_ID",
            "MRDSP_CREATED_AT",
            occurrence=Value("merchant_review_dispute_filed", output_field=CharField()),
            actor_id=merchant_id,
            is_administrative=Value(False, output_field=BooleanField()),
            **common,
        )
        withdrawn = cls._project(
            terminal.filter(MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.WITHDRAWN),
            source_type,
            "MRDSP_ID",
            "MRDSP_RESOLVED_AT",
            occurrence=Value("merchant_review_dispute_withdrawn", output_field=CharField()),
            actor_id=merchant_id,
            new_state=JSONObject(status=F("MRDSP_STATUS")),
            is_administrative=Value(False, output_field=BooleanField()),
            **common,
        )
        resolved = cls._project(
            terminal
            .filter(MRDSP_STATUS__in=tuple(action_statuses.values()))
            .filter(
                ~cls._recorded_resolution(
                    "MRDSP_ID",
                    "MRDSP_STATUS",
                    action_statuses,
                    "dispute_id",
                ),
            ),
            source_type,
            "MRDSP_ID",
            "MRDSP_RESOLVED_AT",
            occurrence=Case(
                *[
                    When(
                        MRDSP_STATUS=status,
                        then=Value(action),
                    )
                    for action, status in action_statuses.items()
                ],
                output_field=CharField(),
            ),
            # The dispute stores its filer, but has no field identifying its administrator resolver.
            new_state=JSONObject(status=F("MRDSP_STATUS")),
            is_administrative=Value(True, output_field=BooleanField()),
            **common,
        )
        closed = cls._project(
            terminal.filter(
                MRDSP_STATUS__in=(
                    MerchantReviewDispute.DisputeStatus.AUTHOR_DELETED,
                    MerchantReviewDispute.DisputeStatus.REVIEW_REMOVED,
                ),
            ),
            source_type,
            "MRDSP_ID",
            "MRDSP_RESOLVED_AT",
            occurrence=Value("merchant_review_dispute_closed", output_field=CharField()),
            # Removal automatically closes a case; its initiating actor is not retained here.
            new_state=JSONObject(
                status=F("MRDSP_STATUS"),
                closure_reason=F("MRDSP_CLOSURE_REASON"),
            ),
            is_administrative=Value(False, output_field=BooleanField()),
            **common,
        )
        return filed, withdrawn, resolved, closed

    @classmethod
    def list_activity(cls):
        """Combine retained source occurrences in SQL before the caller paginates them."""
        return (
            cls._admin_activities()
            .union(
                cls._policy_changes(),
                cls._application_submissions(),
                *cls._change_requests(
                    BusinessNameChangeRequest,
                    "BNCR",
                    "business_name_change",
                    {
                        AdminActivity.Action.BUSINESS_NAME_CHANGE_APPROVED: "approved",
                        AdminActivity.Action.BUSINESS_NAME_CHANGE_REJECTED: "rejected",
                    },
                ),
                *cls._change_requests(
                    BusinessClassificationChangeRequest,
                    "BCCR",
                    "business_classification_change",
                    {
                        AdminActivity.Action.BUSINESS_CLASSIFICATION_CHANGE_APPROVED: "approved",
                        AdminActivity.Action.BUSINESS_CLASSIFICATION_CHANGE_REJECTED: "rejected",
                    },
                ),
                *cls._change_requests(
                    BusinessLocationChangeRequest,
                    "BLCR",
                    "business_location_change",
                    {
                        AdminActivity.Action.BUSINESS_LOCATION_CHANGE_APPROVED: "approved",
                        AdminActivity.Action.BUSINESS_LOCATION_CHANGE_REJECTED: "rejected",
                    },
                ),
                *cls._review_disputes(),
                all=True,
            )
            .order_by(
                "-occurred_at",
                "source_type",
                "source_id",
                "occurrence",
            )
        )
