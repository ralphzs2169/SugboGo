from django.contrib.postgres.aggregates import JSONBAgg
from django.db.models import Count, Max
from django.db.models.functions import Coalesce, JSONObject, TruncDate
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.business.services.vouch_service import VouchService
from apps.reviews.models import Review
from apps.shared.analytics.date_ranges import MANILA


class RecentActivityService:
    """Build a bounded business timeline from domain records, never inbox read state."""

    LIMIT = 5

    @staticmethod
    def _reviews(
        business,
        as_of,
    ):
        """Select public reviews using publication time with an honest legacy fallback."""
        reviews = (
            Review.objects
            .filter(
                BUSN_ID=business,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            )
            .annotate(
                activity_at=Coalesce("REVW_PUBLISHED_AT", "REVW_CREATED_AT"),
            )
            .filter(activity_at__lte=as_of)
            .select_related("USER_ID")
            .only(
                "REVW_ID",
                "REVW_TEXT",
                "REVW_PUBLISHED_AT",
                "REVW_CREATED_AT",
                "USER_ID",
                "USER_ID__USER_FNAME",
                "USER_ID__USER_LNAME",
            )
            .order_by("-activity_at", "-REVW_ID")[:RecentActivityService.LIMIT]
        )
        items = []
        for review in reviews:
            author = review.USER_ID.full_name.strip() or "An explorer"
            text = " ".join(review.REVW_TEXT.split())
            if len(text) > 160:
                text = f"{text[:157].rstrip()}…"
            items.append({
                "id": f"review:{review.pk}",
                "_sort_id": review.pk,
                "type": "review",
                "occurred_at": review.activity_at,
                "date": review.activity_at.astimezone(MANILA).date(),
                "time_basis": (
                    "published_at"
                    if review.REVW_PUBLISHED_AT is not None
                    else "created_at_fallback"
                ),
                "title": f"{author} left a review",
                "description": text,
                "actor_name": author,
                "count": 1,
                "specialties": [],
                "remaining_specialties": 0,
                "target": {"type": "business_review", "id": review.pk},
            })
        return items

    @staticmethod
    def _vouches(
        business,
        as_of,
    ):
        """Aggregate surviving valid vouches per explorer and Manila calendar day."""
        groups = (
            VouchService.get_retained_vouches(business.pk, as_of=as_of)
            .annotate(
                activity_date=TruncDate("VOUCH_CREATED_AT", tzinfo=MANILA),
            )
            .values(
                "USER_ID_id",
                "USER_ID__USER_FNAME",
                "USER_ID__USER_LNAME",
                "activity_date",
            )
            .annotate(
                occurred_at=Max("VOUCH_CREATED_AT"),
                sort_id=Max("VOUCH_ID"),
                count=Count("TAG_ID", distinct=True),
                specialties=JSONBAgg(
                    JSONObject(id="TAG_ID", name="TAG_ID__TAG_NAME"),
                    distinct=True,
                ),
            )
            .order_by("-occurred_at", "-sort_id")[:RecentActivityService.LIMIT]
        )
        items = []
        for group in groups:
            author = (
                f"{group['USER_ID__USER_FNAME']} {group['USER_ID__USER_LNAME']}"
            ).strip() or "An explorer"
            count = group["count"]
            specialties = sorted(
                group["specialties"],
                key=lambda item: (item["name"], item["id"]),
            )[:3]
            description = ", ".join(
                specialty["name"]
                for specialty in specialties
            )
            remaining = count - len(specialties)
            if remaining:
                description = f"{description}, and {remaining} more"
            if count == 1:
                title = f"{author} vouched for a specialty"
            else:
                title = f"{author} vouched for {count} specialties"
            day = group["activity_date"]
            items.append({
                "id": f"vouch:{group['USER_ID_id']}:{day.isoformat()}",
                "_sort_id": group["sort_id"],
                "type": "vouch",
                "occurred_at": group["occurred_at"],
                "date": day,
                "time_basis": "latest_vouch",
                "title": title,
                "description": description,
                "actor_name": author,
                "count": count,
                "specialties": specialties,
                "remaining_specialties": remaining,
                "target": None,
            })
        return items

    @staticmethod
    def _saves(
        business,
        as_of,
    ):
        """Read anonymous daily saver counts without treating tracking failure as zero."""
        try:
            groups = VisibilityEventService.get_recent_save_days(
                business_id=business.pk,
                as_of=as_of,
                limit=RecentActivityService.LIMIT,
            )
        except VisibilityTrackingUnavailable:
            return {"items": [], "availability": "unavailable"}
        items = []
        for group in groups:
            count = group["count"]
            if count == 1:
                title = "An explorer saved your business"
            else:
                title = f"{count} explorers saved your business"
            items.append({
                "id": f"save:{group['date']}",
                "_sort_id": 0,
                "type": "save",
                "occurred_at": group["occurred_at"],
                "date": group["date"],
                "time_basis": "latest_save",
                "title": title,
                "description": "",
                "actor_name": None,
                "count": count,
                "specialties": [],
                "remaining_specialties": 0,
                "target": None,
            })
        return {"items": items, "availability": "available"}

    @staticmethod
    def get_snapshot(user):
        """Resolve authenticated ownership and merge the five newest eligible activity rows."""
        as_of = timezone.now()
        try:
            business = Business.objects.only(
                "BUSN_ID",
                "BUSN_NAME",
                "BUSN_STATUS",
            ).get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.") from None

        reviews = RecentActivityService._reviews(business, as_of)
        vouches = RecentActivityService._vouches(business, as_of)
        save_source = RecentActivityService._saves(business, as_of)
        saves = save_source["items"]
        save_availability = save_source["availability"]
        type_order = {"review": 2, "vouch": 1, "save": 0}
        items = sorted(
            reviews + vouches + saves,
            key=lambda item: (
                item["occurred_at"],
                type_order[item["type"]],
                item["_sort_id"],
            ),
            reverse=True,
        )[:RecentActivityService.LIMIT]
        for item in items:
            item.pop("_sort_id")
        return {
            "business": {
                "id": business.pk,
                "name": business.BUSN_NAME,
                "status": business.BUSN_STATUS,
            },
            "items": items,
            "snapshot_as_of": as_of,
            "is_partial": save_availability == "unavailable",
            "timezone": "Asia/Manila",
            "grouping": {"vouches": "explorer_day", "saves": "day"},
            "sources": {
                "saves": {
                    "availability": save_availability,
                    "coverage": "recorded_events_only",
                },
            },
        }
