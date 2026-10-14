"""Bounded, aggregate-only inspection of the configured visibility store."""

from datetime import UTC, datetime
from time import perf_counter

from django.conf import settings
from pymongo import timeout
from rest_framework.exceptions import ValidationError

from apps.shared.analytics.metadata import build_meta
from apps.shared.services.mongodb_service import MongoDBService

from .visibility_event_service import VisibilityEventService


class VisibilityMongoVerificationService:
    """Inspect connectivity, index definitions and recorded aggregates without initializing indexes."""

    @staticmethod
    def validate_configuration():
        """Require an explicit URI rather than allowing PyMongo's implicit localhost fallback."""
        if not isinstance(settings.MONGODB_URI, str) or not settings.MONGODB_URI.strip():
            raise ValidationError({"configuration": "Configure MONGODB_URI before verification."})
        if not isinstance(settings.MONGODB_DATABASE, str) or not settings.MONGODB_DATABASE.strip():
            raise ValidationError({"configuration": "Configure a nonempty MONGODB_DATABASE."})

    @staticmethod
    def date_text(value):
        """Normalize recorded BSON dates without exposing other document fields."""
        if not isinstance(value, datetime):
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat()

    @staticmethod
    def summarize_plan(plan):
        """Return planner stage and index names only, excluding predicates and execution documents."""
        stages = set()
        indexes = set()

        def inspect(value):
            """Visit planner containers without retaining raw query or document values."""
            if isinstance(value, dict):
                if isinstance(value.get("stage"), str):
                    stages.add(value["stage"])
                if isinstance(value.get("indexName"), str):
                    indexes.add(value["indexName"])
                for nested in value.values():
                    inspect(nested)
            elif isinstance(value, list):
                for nested in value:
                    inspect(nested)

        inspect(plan)
        return {"stages": sorted(stages), "index_names": sorted(indexes)}

    @classmethod
    def inspect(cls, period, *, explain=False, max_time_ms=15000):
        """Read the configured database under a total client deadline without creating data or indexes."""
        cls.validate_configuration()
        if type(max_time_ms) is not int or not 1000 <= max_time_ms <= 60000:
            raise ValidationError({"max_time_ms": "Choose an integer from 1000 to 60000."})
        started = perf_counter()
        name = VisibilityEventService.COLLECTION_NAME
        with timeout(max_time_ms / 1000):
            MongoDBService.ping()
            database = MongoDBService.get_database()
            exists = name in database.list_collection_names(filter={"name": name})
            report = {
                "read_only": True, "ping_ok": True, "database": settings.MONGODB_DATABASE,
                "collection": name, "collection_exists": exists,
                "status": "observed" if exists else "collection_missing",
                "indexes": [], "expected_indexes": {}, "period_totals": None,
                "period_distinct_explorers": None, "first_observed_events": None, "query_planner": None,
                "meta": build_meta(period, partial_reasons=() if exists else ("visibility_collection_missing",)),
            }
            if exists:
                collection = database[name]
                indexes = list(collection.list_indexes())
                report["indexes"] = [{
                    "name": row.get("name"), "keys": list(row["key"].items()),
                    "unique": bool(row.get("unique", False)), "expire_after_seconds": row.get("expireAfterSeconds"),
                } for row in indexes]
                by_name = {row.get("name"): row for row in indexes}
                dedupe = by_name.get(VisibilityEventService.DEDUPE_INDEX_NAME, {})
                aggregation = by_name.get(VisibilityEventService.AGGREGATION_INDEX_NAME, {})
                report["expected_indexes"] = {
                    "unique_dedupe_valid": bool(dedupe.get("unique")) and list(dedupe.get("key", {}).items()) == [("dedupe_key", 1)],
                    "event_business_time_valid": list(aggregation.get("key", {}).items()) == [
                        ("event_type", 1), ("business_id", 1), ("occurred_at", 1),
                    ],
                }
                # Independent inspection pipelines reuse scope/window normalization, not write helpers.
                match = VisibilityEventService._analytics_match()
                match["occurred_at"] = VisibilityEventService._analytics_window(period.start, period.end)
                rows = list(collection.aggregate([
                    {"$match": match}, {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
                ], maxTimeMS=max_time_ms))
                totals = dict.fromkeys(("IMPRESSION", "PROFILE_VISIT", "SAVE"), 0)
                totals.update({row["_id"]: row["count"] for row in rows})
                report["period_totals"] = totals
                distinct = list(collection.aggregate([
                    {"$match": match}, {"$group": {"_id": "$explorer_id"}}, {"$count": "count"},
                ], maxTimeMS=max_time_ms))
                report["period_distinct_explorers"] = distinct[0]["count"] if distinct else 0
                first = list(collection.aggregate([
                    {"$match": VisibilityEventService._analytics_match()},
                    {"$group": {"_id": "$event_type", "first": {"$min": "$occurred_at"}}},
                ], maxTimeMS=max_time_ms))
                report["first_observed_events"] = dict.fromkeys(totals)
                report["first_observed_events"].update({row["_id"]: cls.date_text(row["first"]) for row in first})
                if explain:
                    plan = database.command("explain", {
                        "aggregate": name, "pipeline": [{"$match": match}], "cursor": {},
                    }, verbosity="queryPlanner")
                    report["query_planner"] = cls.summarize_plan(plan)
        report["read_elapsed_ms"] = round((perf_counter() - started) * 1000, 2)
        return report
