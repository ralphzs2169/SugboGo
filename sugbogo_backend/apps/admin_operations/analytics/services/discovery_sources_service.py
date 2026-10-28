"""Platform source attribution over the same population as Discovery Activity."""

from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.shared.analytics.metadata import build_meta


class AdminDiscoverySourcesService:
    """Count stored profile visits without imposing current SQL business eligibility."""

    @staticmethod
    def get_report(period):
        """Group all recorded visits once, retaining unknown attribution and source failures."""
        sources = None
        total = None
        availability = "available"
        reasons = ["client_reported_sources", "best_effort_delivery"]
        try:
            sources = VisibilityEventService.get_profile_visit_sources(
                business_ids=None,
                platform=True,
                start_time=period.start,
                end_time=period.end,
            )
            total = sum(row["count"] for row in sources)
            for row in sources:
                if total:
                    row["share_percent"] = round(row["count"] / total * 100, 2)
                else:
                    row["share_percent"] = None
        except VisibilityTrackingUnavailable as error:
            availability = "unavailable"
            reasons.append(error.reason or "profile_visit_sources_unavailable")
        return {
            "total_profile_visits": total,
            "sources": sources,
            "definitions": {
                "population": "All stored PROFILE_VISIT events in the selected half-open period, matching Admin Discovery Activity. No current business status, owner, or taxonomy filter is added at read time.",
                "deduplication": "Event type, account, business and UTC day identify a recorded visit. Source is not part of this identity; the first persisted visit retains its source.",
                "attribution": "Sources describe recorded daily-deduplicated profile visits, not every opening, multi-touch journeys, conversion, CTR or physical visits.",
                "unknown": "Missing or unrecognized sources are Unknown and remain in the full-total share denominator. Shares are undefined when the total is zero.",
                "freshness": "Delivery completeness and freshness are unverified. A successful read or latest event does not certify coverage. No additional report-time exclusions are applied.",
            },
            "meta": build_meta(
                period,
                availability=availability,
                partial_reasons=reasons,
            ),
        }
