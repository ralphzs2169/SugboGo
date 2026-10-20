"""Standard classification of existing profile observations without inventing origins."""

from apps.business.services.discovery_source import DiscoverySource
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from .standard_analytics_service import standard_meta


class DiscoverySourcesService:
    """Resolve ownership and derive source totals from the same Mongo aggregation."""

    @staticmethod
    def get_report(
        user,
        period,
    ):
        """Preserve unknown attribution separately from unavailable event storage."""
        business = BusinessProfileService.get_business_for_merchant(user)
        reasons = ["client_reported_sources", "best_effort_delivery"]
        sources = None
        total = None
        attribution_complete = None
        availability = "partial"
        try:
            sources = VisibilityEventService.get_profile_visit_sources(
                business_ids=[business.pk],
                start_time=period.start,
                end_time=period.end,
            )
            total = sum(row["count"] for row in sources)
            unknown = next(
                row["count"]
                for row in sources
                if row["source"] == DiscoverySource.UNKNOWN
            )
            attribution_complete = unknown == 0
            if unknown:
                reasons.append("unattributed_profile_visits")
        except VisibilityTrackingUnavailable as error:
            availability = "unavailable"
            reasons.insert(0, error.reason or "profile_visit_sources_unavailable")
        return {
            "business": {
                "id": business.pk,
                "name": business.BUSN_NAME,
                "status": business.BUSN_STATUS,
            },
            "profile_visits": total,
            "sources": sources,
            "attribution_complete": attribution_complete,
            "meta": standard_meta(
                period,
                availability=availability,
                coverage_verified=False,
                partial_reasons=reasons,
            ),
        }
