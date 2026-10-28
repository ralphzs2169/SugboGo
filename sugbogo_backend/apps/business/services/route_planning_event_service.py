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


class RoutePlanningInitializationError(APIException):
    status_code = 503
    default_detail = (
        "Route-planning initialization metadata is invalid. "
        "Inspect tracking-state-v1; its timestamp has not been reset."
    )
    default_code = "route_tracking_not_initialized"


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
        *,
        verify=False,
    ):
        """Ensure ingestion indexes, bypassing the process cache for explicit setup."""
        with cls._index_lock:
            if cls._indexes_initialized and not verify:
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
    def initialize_tracking(
        cls,
        *,
        verify_indexes=True,
    ):
        """Initialize indexes and a UTC history boundary without creating observations."""
        try:
            collection = cls._get_collection()
            cls._ensure_indexes(
                collection,
                verify=verify_indexes,
            )
            initialized_at = timezone.now().astimezone(UTC)
            try:
                write = collection.update_one(
                    {"_id": cls.STATE_ID},
                    {"$setOnInsert": {"started_at": initialized_at}},
                    upsert=True,
                )
                initialized = write.upserted_id is not None
            except DuplicateKeyError:
                # Another initializer may have inserted the singleton first.
                initialized = False
            state = collection.find_one({"_id": cls.STATE_ID})
            if state is None:
                raise RoutePlanningInitializationError()
            started_at = state.get("started_at")
            if not isinstance(started_at, datetime):
                raise RoutePlanningInitializationError()
            if timezone.is_naive(started_at):
                started_at = started_at.replace(tzinfo=UTC)
            return {
                "initialized": initialized,
                "started_at": started_at.astimezone(UTC),
            }
        except PyMongoError as exc:
            # Driver messages can contain connection details; log only diagnostics.
            logger.error(
                "Route-planning initialization failed: type=%s code=%s",
                type(exc).__name__,
                getattr(exc, "code", None),
            )
            raise RoutePlanningUnavailable(
                detail=(
                    "Route-planning initialization failed "
                    f"({type(exc).__name__}; code={getattr(exc, 'code', None)}). "
                    "Check MongoDB connectivity, write permissions and index conflicts."
                ),
            ) from exc

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

        try:
            cls.initialize_tracking(verify_indexes=False)
            collection = cls._get_collection()
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
            logger.error(
                "Route-planning event write failed: type=%s code=%s method=%s",
                type(exc).__name__,
                getattr(exc, "code", None),
                method.value,
            )
            raise RoutePlanningUnavailable() from exc
        logger.debug(
            "Route-planning ingestion completed: method=%s recorded=%s duplicate=%s",
            method.value,
            result["recorded"],
            result["duplicate"],
        )
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
        except PyMongoError as exc:
            logger.error(
                "Route-planning analytics read failed: type=%s code=%s",
                type(exc).__name__,
                getattr(exc, "code", None),
            )
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


    @classmethod
    def read_platform(
        cls,
        period,
        interval,
    ):
        """Read bounded platform aggregates without initializing tracking or indexes."""
        if interval not in ("daily", "weekly"):
            raise ValidationError({"interval": "Choose daily or weekly."})
        started_at = None
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
            truncation = {
                "date": "$occurred_at",
                "unit": "day" if interval == "daily" else "week",
                "timezone": "Asia/Manila",
            }
            if interval == "weekly":
                truncation["startOfWeek"] = "monday"
            methods = [method.value for method in NavigationMethod]
            pipeline = [
                {"$match": {
                    "navigation_method": {"$exists": True},
                    "occurred_at": {
                        "$gte": max(period.start, started_at),
                        "$lt": period.end,
                    },
                }},
                {"$set": {"report_method": {"$cond": [
                    {"$in": ["$navigation_method", methods]},
                    "$navigation_method",
                    "OTHER",
                ]}}},
                {"$facet": {
                    "methods": [
                        {"$group": {"_id": "$report_method", "count": {"$sum": 1}}},
                    ],
                    "accounts": [
                        {"$match": {"explorer_id": {"$type": "number", "$gt": 0}}},
                        {"$group": {"_id": "$explorer_id"}},
                        {"$count": "count"},
                    ],
                    "unknown_accounts": [
                        {"$match": {"$nor": [{"explorer_id": {"$type": "number", "$gt": 0}}]}},
                        {"$count": "count"},
                    ],
                    "series": [
                        {"$group": {
                            "_id": {"bucket": {"$dateTrunc": truncation}, "method": "$report_method"},
                            "count": {"$sum": 1},
                        }},
                        {"$sort": {"_id.bucket": 1, "_id.method": 1}},
                    ],
                    "destinations": [
                        {"$group": {
                            "_id": "$business_id",
                            "count": {"$sum": 1},
                            **{
                                method.lower(): {"$sum": {"$cond": [
                                    {"$eq": ["$report_method", method]}, 1, 0,
                                ]}}
                                for method in [*methods, "OTHER"]
                            },
                        }},
                        {"$sort": {"count": -1, "_id": 1}},
                        {"$limit": 10},
                    ],
                }},
            ]
            rows = list(collection.aggregate(pipeline))
            return rows[0], started_at, None
        except PyMongoError:
            return None, started_at, "route_source_unavailable"
