"""Typed read projections over authoritative activity sources without copying their records."""

import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

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
    Q,
    Value,
    When,
)
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce, JSONObject, NullIf
from rest_framework.exceptions import NotFound

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.authentication.models import LoginEvent
from apps.authentication.services.login_history_service import LoginHistoryService
from apps.business.models import BusinessPocket, BusinessVouch
from apps.merchant_application.models import MerchantApplicationSubmission
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewLike
from apps.users.models import User


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

    @staticmethod
    def resolve_current_actors(events):
        """Load only current public identity fields for the distinct actors in the supplied page."""
        actor_ids = {
            event["actor_id"]
            for event in events
            if (
                event["actor_id"] is not None
                and event["actor_id"] > 0
            )
        }
        if not actor_ids:
            return {}
        return (
            User.objects
            .only(
                "USER_ID",
                "USER_FNAME",
                "USER_LNAME",
                "USER_ROLE",
                "USER_PROFILE_PICTURE",
                "USER_AVATAR_KEY",
            )
            .in_bulk(actor_ids)
        )

    MERCHANT_SOURCES = (
        "merchant_application_submission",
        "business_name_change_request",
        "business_classification_change_request",
        "business_location_change_request",
        "merchant_review_dispute",
    )
    EXPLORER_SOURCES = (
        "review",
        "business_vouch",
        "business_pocket",
        "review_like",
    )
    SOURCE_TYPES = (
        "admin_activity",
        "analytics_policy_change",
        "login_event",
        *MERCHANT_SOURCES,
        *EXPLORER_SOURCES,
    )
    MODULES = (
        *AdminActivity.Module.values,
        "system_configuration",
        "reviews",
        "pocket",
        "community",
        "authentication",
    )
    ACTIONS = (
        *AdminActivity.Action.values,
        "analytics_policy_revision",
        "merchant_application_submitted",
        *[
            f"{source}_{occurrence}"
            for source in MERCHANT_SOURCES[1:4]
            for occurrence in ("submitted", "withdrawn")
        ],
        "merchant_review_dispute_filed",
        "merchant_review_dispute_withdrawn",
        "merchant_review_dispute_closed",
        "review_submitted",
        "business_vouch_submitted",
        "business_vouch_withdrawn",
        "business_saved",
        "review_liked",
        "login_succeeded",
        "login_failed",
        "login_unavailable",
    )

    @staticmethod
    def category_for(event):
        """Categorize the occurrence by recorded classification and source, never current user role."""
        if event["is_administrative"] is True:
            return "administrative"
        if event["source_type"] == "login_event":
            return "authentication"
        if event["is_administrative"] is False:
            if event["source_type"] in UnifiedActivityService.MERCHANT_SOURCES:
                return "merchant"
            if (
                event["source_type"] in UnifiedActivityService.EXPLORER_SOURCES
                or event["occurrence"] == AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR
            ):
                return "explorer"
        return None

    @staticmethod
    def event_identity(event):
        """Address each source occurrence independently without a new database identifier."""
        return f"{event['source_type']}:{event['source_id']}:{event['occurrence']}"

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
        # The author-deletion writer retains this identifier before removing the review row.
        legacy_author_target = Q(
            AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            AACT_CONTEXT__review_id__regex=r"^[1-9][0-9]{0,9}$",
        )
        return cls._project(
            AdminActivity.objects.all(),
            "admin_activity",
            "AACT_ID",
            "AACT_CREATED_AT",
            occurrence=F("AACT_ACTION"),
            module=Coalesce(
                "AACT_MODULE",
                Case(
                    When(
                        AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
                        then=Value("reviews"),
                    ),
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
            target_type=Coalesce(
                "AACT_TARGET_TYPE",
                Case(
                    When(
                        legacy_author_target,
                        then=Value("review"),
                    ),
                    output_field=CharField(),
                ),
                output_field=CharField(),
            ),
            target_id=Coalesce(
                "AACT_TARGET_ID",
                Case(
                    When(
                        legacy_author_target,
                        then=KeyTextTransform("review_id", "AACT_CONTEXT"),
                    ),
                    output_field=CharField(),
                ),
                output_field=CharField(),
            ),
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
    def _reviews(cls):
        """Read retained submission receipts without exposing content or treating latest edits as history."""
        return cls._project(
            Review.objects.all(),
            "review",
            "REVW_ID",
            "REVW_CREATED_AT",
            occurrence=Value("review_submitted", output_field=CharField()),
            module=Value("reviews", output_field=CharField()),
            actor_id=Cast("USER_ID_id", output_field=BigIntegerField()),
            target_type=Value("review", output_field=CharField()),
            target_id=Cast("REVW_ID", output_field=CharField()),
            is_administrative=Value(False, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(Review._meta.label_lower),
                business_id=F("BUSN_ID_id"),
            ),
        )

    @classmethod
    def _vouches(cls):
        """Preserve original endorsement time and only the withdrawal timestamp still retained by its row."""
        queryset = BusinessVouch.objects.all()
        common = {
            "module": Value("business", output_field=CharField()),
            "actor_id": Cast("USER_ID_id", output_field=BigIntegerField()),
            "target_type": Value("business_vouch", output_field=CharField()),
            "target_id": Cast("VOUCH_ID", output_field=CharField()),
            "is_administrative": Value(False, output_field=BooleanField()),
            "provenance": JSONObject(
                model=Value(BusinessVouch._meta.label_lower),
                business_id=F("BUSN_ID_id"),
                specialty_tag_id=F("TAG_ID_id"),
            ),
        }
        submitted = cls._project(
            queryset,
            "business_vouch",
            "VOUCH_ID",
            "VOUCH_CREATED_AT",
            occurrence=Value("business_vouch_submitted", output_field=CharField()),
            **common,
        )
        withdrawn = cls._project(
            queryset.filter(VOUCH_WITHDRAWN_AT__isnull=False),
            "business_vouch",
            "VOUCH_ID",
            "VOUCH_WITHDRAWN_AT",
            occurrence=Value("business_vouch_withdrawn", output_field=CharField()),
            **common,
        )
        return submitted, withdrawn

    @classmethod
    def _pocket_saves(cls):
        """Read each retained save once without reconstructing removals or duplicating collection memberships."""
        return cls._project(
            BusinessPocket.objects.all(),
            "business_pocket",
            "PCKT_ID",
            "PCKT_CREATED_AT",
            occurrence=Value("business_saved", output_field=CharField()),
            module=Value("pocket", output_field=CharField()),
            actor_id=Cast("USER_ID_id", output_field=BigIntegerField()),
            target_type=Value("business", output_field=CharField()),
            target_id=Cast("BUSN_ID_id", output_field=CharField()),
            is_administrative=Value(False, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(BusinessPocket._meta.label_lower),
                business_id=F("BUSN_ID_id"),
            ),
        )

    @classmethod
    def _community_likes(cls):
        """Represent retained community likes without inventing posts, comments, or deleted unlike events."""
        return cls._project(
            ReviewLike.objects.all(),
            "review_like",
            "RLIK_ID",
            "RLIK_CREATED_AT",
            occurrence=Value("review_liked", output_field=CharField()),
            module=Value("community", output_field=CharField()),
            actor_id=Cast("USER_ID_id", output_field=BigIntegerField()),
            target_type=Value("review", output_field=CharField()),
            target_id=Cast("REVW_ID_id", output_field=CharField()),
            is_administrative=Value(False, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(ReviewLike._meta.label_lower),
                review_id=F("REVW_ID_id"),
                business_id=F("REVW_ID__BUSN_ID_id"),
            ),
        )

    @classmethod
    def _authentication_events(cls):
        """Read retained verified sign-ins and attributable OAuth outcomes without client or credential data."""
        queryset = (
            LoginEvent.objects
            .filter(
                USER__isnull=False,
                LEVT_CREATED_AT__gte=LoginHistoryService.cutoff(),
                LEVT_METHOD__in=LoginEvent.Method.values,
            )
            .filter(
                Q(LEVT_OUTCOME=LoginEvent.Outcome.SUCCESS)
                | Q(
                    LEVT_METHOD__in=(
                        LoginEvent.Method.GOOGLE,
                        LoginEvent.Method.FACEBOOK,
                    ),
                    LEVT_OUTCOME__in=(
                        LoginEvent.Outcome.FAILED,
                        LoginEvent.Outcome.UNAVAILABLE,
                    ),
                ),
            )
        )
        # Password failures can name another account; only OAuth failures carry verified identity linkage.
        return cls._project(
            queryset,
            "login_event",
            "LEVT_ID",
            "LEVT_CREATED_AT",
            occurrence=Case(
                When(
                    LEVT_OUTCOME=LoginEvent.Outcome.SUCCESS,
                    then=Value("login_succeeded"),
                ),
                When(
                    LEVT_OUTCOME=LoginEvent.Outcome.FAILED,
                    then=Value("login_failed"),
                ),
                When(
                    LEVT_OUTCOME=LoginEvent.Outcome.UNAVAILABLE,
                    then=Value("login_unavailable"),
                ),
                output_field=CharField(),
            ),
            module=Value("authentication", output_field=CharField()),
            actor_id=Cast("USER_id", output_field=BigIntegerField()),
            target_type=Value("user", output_field=CharField()),
            target_id=Cast("USER_id", output_field=CharField()),
            outcome=F("LEVT_OUTCOME"),
            is_administrative=Value(False, output_field=BooleanField()),
            provenance=JSONObject(
                model=Value(LoginEvent._meta.label_lower),
                method=F("LEVT_METHOD"),
            ),
        )

    @classmethod
    def _projections(cls):
        """Build the existing source projections with their original deduplication rules."""
        return (
            cls._admin_activities(),
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
            cls._reviews(),
            *cls._vouches(),
            cls._pocket_saves(),
            cls._community_likes(),
            cls._authentication_events(),
        )

    @classmethod
    def list_activity(
        cls,
        *,
        category="all",
        module=None,
        action=None,
        actor_id=None,
        start_date=None,
        end_date=None,
        source_type=None,
        source_id=None,
        occurrence=None,
    ):
        """Filter every SQL projection before union, preserving global database pagination."""
        filters = {}
        for field, value in (
            ("module", module),
            ("occurrence", action),
            ("actor_id", actor_id),
            ("source_type", source_type),
            ("source_id", source_id),
            ("occurrence", occurrence),
        ):
            if value is not None:
                filters[field] = value
        manila = ZoneInfo("Asia/Manila")
        if start_date is not None:
            filters["occurred_at__gte"] = datetime.combine(
                start_date,
                time.min,
                tzinfo=manila,
            )
        if end_date is not None:
            filters["occurred_at__lt"] = datetime.combine(
                end_date + timedelta(days=1),
                time.min,
                tzinfo=manila,
            )
        category_filters = {
            "all": Q(),
            "administrative": Q(is_administrative=True),
            "authentication": Q(source_type="login_event"),
            "merchant": Q(
                is_administrative=False,
                source_type__in=cls.MERCHANT_SOURCES,
            ),
            "explorer": Q(is_administrative=False) & (
                Q(source_type__in=cls.EXPLORER_SOURCES)
                | Q(
                    source_type="admin_activity",
                    occurrence=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
                )
            ),
        }
        projections = [
            projection.filter(category_filters[category], **filters)
            for projection in cls._projections()
        ]
        return (
            projections[0]
            .union(*projections[1:], all=True)
            .order_by(
                "-occurred_at",
                "source_type",
                "source_id",
                "occurrence",
            )
        )

    @classmethod
    def current_vouch_records(
        cls,
        event,
    ):
        """Resolve only current vouch-related names while keeping projected record IDs authoritative."""
        if event["source_type"] != "business_vouch":
            return None
        provenance = event["provenance"]
        business_id = provenance.get("business_id")
        specialty_id = provenance.get("specialty_tag_id")
        if (
            business_id is None
            and specialty_id is None
        ):
            return None
        current = BusinessVouch.objects.filter(pk=event["source_id"]).values(
            "BUSN_ID_id",
            "BUSN_ID__BUSN_NAME",
            "TAG_ID_id",
            "TAG_ID__TAG_NAME",
        ).first()
        if current is None:
            current = {}
        records = {}
        for label, identifier, id_field, name_field in (
            ("business", business_id, "BUSN_ID_id", "BUSN_ID__BUSN_NAME"),
            ("specialty_tag", specialty_id, "TAG_ID_id", "TAG_ID__TAG_NAME"),
        ):
            if identifier is None:
                records[label] = None
                continue
            name = None
            if current.get(id_field) == identifier:
                name = current.get(name_field)
            records[label] = {"id": identifier, "name": name}
        return records

    @classmethod
    def get_activity(
        cls,
        event_id,
    ):
        """Resolve only an occurrence still present in the same retained, deduplicated unified query."""
        parts = event_id.split(":")
        if (
            len(parts) != 3
            or parts[0] not in cls.SOURCE_TYPES
            or re.fullmatch(r"[1-9][0-9]{0,18}", parts[1]) is None
            or re.fullmatch(r"[a-z][a-z0-9_]{0,63}", parts[2]) is None
        ):
            raise NotFound("Activity not found.")
        source_type = parts[0]
        source_id = parts[1]
        occurrence = parts[2]
        events = list(
            cls.list_activity(
                source_type=source_type,
                source_id=source_id,
                occurrence=occurrence,
            )[:1],
        )
        if not events:
            raise NotFound("Activity not found.")
        event = events[0]
        event["previous_state"] = None
        event["reason"] = None
        event["context"] = None
        if source_type == "admin_activity":
            details = AdminActivity.objects.filter(pk=source_id).values(
                "AACT_PREVIOUS_STATE",
                "AACT_REASON",
                "AACT_CONTEXT",
            ).first()
            if details is None:
                raise NotFound("Activity not found.")
            event["previous_state"] = details["AACT_PREVIOUS_STATE"]
            event["reason"] = details["AACT_REASON"]
            event["context"] = details["AACT_CONTEXT"]
            if (
                event["reason"] is None
                and occurrence in (
                    AdminActivity.Action.USER_SUSPENDED,
                    AdminActivity.Action.BUSINESS_SUSPENDED,
                )
                and isinstance(event["context"], dict)
            ):
                event["reason"] = event["context"].get("reason")
        elif source_type == "analytics_policy_change":
            details = AnalyticsPolicyChange.objects.filter(pk=source_id).values(
                "APCH_BEFORE",
                "APCH_REASON",
            ).first()
            if details is None:
                raise NotFound("Activity not found.")
            event["previous_state"] = details["APCH_BEFORE"]
            event["reason"] = details["APCH_REASON"]
        event["current_related_records"] = cls.current_vouch_records(event)
        return event
