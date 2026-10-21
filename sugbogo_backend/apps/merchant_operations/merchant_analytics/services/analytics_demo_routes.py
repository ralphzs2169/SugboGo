"""Own exact demo route observations without changing shared tracking history."""

from datetime import UTC, datetime

from rest_framework.exceptions import ValidationError

from apps.business.services.route_planning_event_service import RoutePlanningEventService

from .analytics_demo_visibility import AnalyticsDemoVisibility
from .analytics_demo_dataset import parse_timestamp


class AnalyticsDemoRoutes(AnalyticsDemoVisibility):
    """Reuse strict manifest ownership for the existing route-intent collection."""

    COLLECTION_NAME = RoutePlanningEventService.COLLECTION_NAME
    INDEXES = {
        RoutePlanningEventService.DEDUPE_INDEX_NAME: {
            "key": [
                ("explorer_id", 1),
                ("business_id", 1),
                ("navigation_method", 1),
                ("utc_day", 1),
            ],
            "unique": True,
            "partialFilterExpression": {"navigation_method": {"$exists": True}},
        },
        RoutePlanningEventService.AGGREGATION_INDEX_NAME: {
            "key": [("business_id", 1), ("occurred_at", 1)],
            "unique": False,
        },
    }

    @staticmethod
    def identity_query(document):
        """Preserve the account, business, method and UTC-day unique identity."""
        return {
            key: document[key]
            for key in ("explorer_id", "business_id", "navigation_method", "utc_day")
        }

    def inspect(
        self,
        business_id,
    ):
        """Read existing initialization metadata without creating or changing its timestamp."""
        inventory = super().inspect(business_id)
        state = self.collection.find_one({"_id": RoutePlanningEventService.STATE_ID})
        started_at = None
        if state is not None and isinstance(state.get("started_at"), datetime):
            started_at = state["started_at"]
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=UTC)
            started_at = started_at.astimezone(UTC)
        if started_at:
            inventory["tracking_started_at"] = started_at.isoformat()
        else:
            inventory["tracking_started_at"] = None
        inventory["coverage_verified"] = False
        inventory["limitation"] = (
            "Only activity after the existing tracking start is eligible; demo data does not verify coverage."
            if started_at
            else "Run initialize_route_planning_tracking separately; no route observations will be inserted."
        )
        return inventory

    def validate_plan(
        self,
        plan,
    ):
        """Refuse altered history boundaries or planned observations outside their signed window."""
        if plan is None:
            return
        actual = self.inspect(plan["business_id"])["tracking_started_at"]
        if (
            actual is None
            or parse_timestamp(actual) != parse_timestamp(plan["tracking_started_at"])
        ):
            raise ValidationError(
                "Route tracking metadata changed; inspect the signed plan before resuming.",
            )
        start = parse_timestamp(plan["tracking_started_at"])
        end = parse_timestamp(plan["anchor"])
        for event in plan["events"]:
            stamp = parse_timestamp(event["at"])
            if not start <= stamp < end:
                raise ValidationError("A planned route observation falls outside initialized tracking.")
