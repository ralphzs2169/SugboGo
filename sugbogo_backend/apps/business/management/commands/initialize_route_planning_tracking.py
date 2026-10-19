"""Explicitly initialize route-intent storage without generating analytics activity."""

import json

from django.core.management.base import BaseCommand, CommandError

from apps.business.services.route_planning_event_service import (
    RoutePlanningEventService,
    RoutePlanningInitializationError,
    RoutePlanningUnavailable,
)


class Command(BaseCommand):
    """Ensure configured MongoDB indexes and preserve the original tracking boundary."""

    help = "Initialize route-planning tracking indexes and metadata; creates no events."
    requires_system_checks = []

    def handle(
        self,
        *args,
        **options,
    ):
        """Report idempotent setup results or a sanitized, actionable failure."""
        try:
            result = RoutePlanningEventService.initialize_tracking()
        except (RoutePlanningUnavailable, RoutePlanningInitializationError) as exc:
            raise CommandError(str(exc.detail)) from None
        report = {
            "collection": RoutePlanningEventService.COLLECTION_NAME,
            "status": "already_initialized",
            "tracking_started_at": result["started_at"].isoformat(),
            "indexes": [
                RoutePlanningEventService.DEDUPE_INDEX_NAME,
                RoutePlanningEventService.AGGREGATION_INDEX_NAME,
            ],
            "synthetic_events_created": 0,
            "coverage_verified": False,
        }
        if result["initialized"]:
            report["status"] = "initialized"
        self.stdout.write(json.dumps(report, indent=2))
