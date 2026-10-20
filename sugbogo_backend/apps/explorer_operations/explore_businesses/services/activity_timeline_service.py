from django.db.models import (
    CharField,
    DateTimeField,
    F,
    IntegerField,
    TextField,
    Value,
)
from django.db.models.functions import Cast, Substr

from apps.business.models import Business, BusinessPocket
from apps.reviews.models import Review

from .vouch_history_service import VouchHistoryService


class ActivityTimelineService:
    """Combines retained private activity in database order before pagination."""

    COLUMNS = (
        "activity_type",
        "source_id",
        "occurred_at",
        "business_id",
        "business_name",
        "business_status",
        "specialty_id",
        "specialty_name",
        "review_excerpt",
        "review_status",
        "review_edited_at",
    )

    @staticmethod
    def _project(
        queryset,
        activity_type,
        id_field,
        timestamp_field,
        **details,
    ):
        """Projects identical typed columns for database UNION across activity models."""
        annotations = {
            "activity_type": Value(activity_type, output_field=CharField()),
            "source_id": F(id_field),
            "occurred_at": F(timestamp_field),
            "business_id": F("BUSN_ID_id"),
            "business_name": F("BUSN_ID__BUSN_NAME"),
            "business_status": F("BUSN_ID__BUSN_STATUS"),
            "specialty_id": Cast(Value(None), output_field=IntegerField()),
            "specialty_name": Value(None, output_field=CharField()),
            "review_excerpt": Value(None, output_field=TextField()),
            "review_status": Value(None, output_field=CharField()),
            # PostgreSQL must not resolve the first two NULL branches as text.
            "review_edited_at": Cast(Value(None), output_field=DateTimeField()),
        }
        annotations.update(details)
        return (
            queryset
            .order_by()
            .annotate(**annotations)
            .values(*ActivityTimelineService.COLUMNS)
        )

    @staticmethod
    def list_activity(
        user,
        activity_type="all",
    ):
        """Returns only the account's eligible saves, endorsements, and author reviews."""
        queries = []
        if activity_type in ("all", "saves"):
            queries.append(
                ActivityTimelineService._project(
                    BusinessPocket.objects.filter(
                        USER_ID=user,
                        BUSN_ID__BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                    ),
                    "save",
                    "PCKT_ID",
                    "PCKT_CREATED_AT",
                ),
            )
        if activity_type in ("all", "vouches"):
            queries.append(
                ActivityTimelineService._project(
                    VouchHistoryService._eligible_vouches(user),
                    "vouch",
                    "VOUCH_ID",
                    "VOUCH_CREATED_AT",
                    specialty_id=F("TAG_ID_id"),
                    specialty_name=F("TAG_ID__TAG_NAME"),
                ),
            )
        if activity_type in ("all", "reviews"):
            queries.append(
                ActivityTimelineService._project(
                    Review.objects.filter(USER_ID=user),
                    "review",
                    "REVW_ID",
                    "REVW_CREATED_AT",
                    review_excerpt=Substr("REVW_TEXT", 1, 180),
                    review_status=F("REVW_STATUS"),
                    review_edited_at=F("REVW_EDITED_AT"),
                ),
            )

        # UNION ALL retains distinct actions even when timestamps and business match.
        queryset = queries[0]
        if len(queries) > 1:
            queryset = queryset.union(*queries[1:], all=True)
        return queryset.order_by(
            "-occurred_at",
            "activity_type",
            "-source_id",
        )
