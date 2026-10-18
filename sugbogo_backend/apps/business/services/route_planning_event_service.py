"""Minimal, server-timed route intent observations independent of discovery scoring."""

import logging
from datetime import UTC, datetime
from enum import StrEnum
from threading import Lock

from django.utils import timezone
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.business.models import Business
from apps.shared.services.mongodb_service import MongoDBService

logger = logging.getLogger(__name__)


class NavigationMethod(StrEnum):
    ROAD_ROUTE = "ROAD_ROUTE"
    JEEPNEY = "JEEPNEY"


class RoutePlanningUnavailable(APIException):
    status_code = 503
    default_detail = "Route-planning tracking is temporarily unavailable."
    default_code = "route_planning_unavailable"


class RoutePlanningEventService:
    """Atomically deduplicate requests without storing coordinates or route contents."""

    COLLECTION_NAME = "route_planning_events"
    DEDUPE_INDEX_NAME = "route_intent_account_business_method_day_unique"
    AGGREGATION_INDEX_NAME = "route_intent_business_time"
    STATE_ID = "tracking-state-v1"
    _index_lock = Lock()
    _indexes_initialized = False

    @staticmethod
    def _get_business(
        business_id,
    ):
        """Resolve an active target using controlled service-layer retrieval."""
        try:
            return Business.objects.get(
                BUSN_ID=business_id,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

    @classmethod
    def _get_collection(cls):
        """Reuse the shared MongoDB client and configured database."""
        return MongoDBService.get_database()[cls.COLLECTION_NAME]

    @classmethod
    def _ensure_indexes(
        cls,
        collection,
    ):
        """Create ingestion indexes only on writes, before any event can be inserted."""
        with cls._index_lock:
            if cls._indexes_initialized:
                return
            collection.create_index(
                [
                    ("explorer_id", ASCENDING),
                    ("business_id", ASCENDING),
                    ("navigation_method", ASCENDING),
                    ("utc_day", ASCENDING),
                ],
                unique=True,
                partialFilterExpression={
                    "navigation_method": {"$exists": True},
                },
                name=cls.DEDUPE_INDEX_NAME,
            )
            collection.create_index(
                [
                    ("business_id", ASCENDING),
                    ("occurred_at", ASCENDING),
                ],
                name=cls.AGGREGATION_INDEX_NAME,
            )
            cls._indexes_initialized = True

    @classmethod
    def record_intent(
        cls,
        user,
        business_id,
        navigation_method,
    ):
        """Record an authenticated deliberate request once per method and UTC day."""
        try:
            method = NavigationMethod(navigation_method)
        except (TypeError, ValueError):
            raise ValidationError(
                {"navigation_method": "Choose ROAD_ROUTE or JEEPNEY."},
            ) from None
        business = cls._get_business(business_id)
        result = {
            "business_id": business.pk,
            "navigation_method": method.value,
            "recorded": False,
            "duplicate": False,
            "excluded_reason": None,
        }
        if business.USER_ID_id == user.pk:
            result["excluded_reason"] = "business_owner"
            return result

        initialized_at = timezone.now().astimezone(UTC)
        try:
            collection = cls._get_collection()
            cls._ensure_indexes(collection)
            # This records collection initialization, not complete client coverage.
            # It is not reconstructed from event counts or seeded history.
            try:
                collection.update_one(
                    {"_id": cls.STATE_ID},
                    {"$setOnInsert": {"started_at": initialized_at}},
                    upsert=True,
                )
            except DuplicateKeyError:
                # A concurrent first request may initialize the same state document.
                if collection.find_one({"_id": cls.STATE_ID}) is None:
                    raise
            # Timestamp after initialization so concurrent first requests cannot
            # insert observations earlier than the persisted collection boundary.
            occurred_at = timezone.now().astimezone(UTC)
            key = {
                "explorer_id": user.pk,
                "business_id": business.pk,
                "navigation_method": method.value,
                "utc_day": occurred_at.date().isoformat(),
            }
            try:
                write = collection.update_one(
                    key,
                    {"$setOnInsert": {**key, "occurred_at": occurred_at}},
                    upsert=True,
                )
                result["recorded"] = write.upserted_id is not None
                result["duplicate"] = not result["recorded"]
            except DuplicateKeyError:
                # The unique index remains authoritative for simultaneous upserts.
                result["duplicate"] = True
        except PyMongoError as exc:
            logger.exception("Failed to persist route-planning intent.")
            raise RoutePlanningUnavailable() from exc
        return result

    @classmethod
    def get_totals(
        cls,
        business_id,
        owner_id,
        period,
    ):
        """Read recorded counts with an explicit lower bound on collection history."""
        try:
            collection = cls._get_collection()
            state = collection.find_one({"_id": cls.STATE_ID})
            if state is None:
                names = collection.database.list_collection_names(
                    filter={"name": cls.COLLECTION_NAME},
                )
                if cls.COLLECTION_NAME not in names:
                    return None, None, "route_intent_collection_missing"
                return None, None, "route_tracking_not_initialized"
            started_at = state.get("started_at")
            if not isinstance(started_at, datetime):
                return None, None, "route_tracking_not_initialized"
            if timezone.is_naive(started_at):
                started_at = started_at.replace(tzinfo=UTC)
            started_at = started_at.astimezone(UTC)
            if started_at >= period.end:
                return None, started_at, "tracking_not_started_in_period"
            start = max(period.start, started_at)
            pipeline = [
                {
                    "$match": {
                        "business_id": business_id,
                        "explorer_id": {"$ne": owner_id},
                        "navigation_method": {
                            "$in": [
                                method.value
                                for method in NavigationMethod
                            ],
                        },
                        "occurred_at": {
                            "$gte": start,
                            "$lt": period.end,
                        },
                    },
                },
                {
                    "$group": {
                        "_id": "$explorer_id",
                        "road": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$eq": [
                                            "$navigation_method",
                                            NavigationMethod.ROAD_ROUTE.value,
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        "jeepney": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$eq": [
                                            "$navigation_method",
                                            NavigationMethod.JEEPNEY.value,
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
                {
                    "$group": {
                        "_id": None,
                        "total_requests": {
                            "$sum": {"$add": ["$road", "$jeepney"]},
                        },
                        "distinct_explorer_accounts": {"$sum": 1},
                        "road_route_requests": {"$sum": "$road"},
                        "jeepney_requests": {"$sum": "$jeepney"},
                    },
                },
                {"$project": {"_id": 0}},
            ]
            rows = list(
                collection.aggregate(pipeline),
            )
        except PyMongoError:
            logger.exception("Failed to read route-planning analytics.")
            return None, None, "route_source_unavailable"
        totals = {
            "total_requests": 0,
            "distinct_explorer_accounts": 0,
            "road_route_requests": 0,
            "jeepney_requests": 0,
        }
        if rows:
            totals.update(rows[0])
        return totals, started_at, None
