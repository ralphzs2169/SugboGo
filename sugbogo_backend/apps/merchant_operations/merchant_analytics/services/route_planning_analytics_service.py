from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from apps.shared.analytics.metadata import build_meta


class RoutePlanningAnalyticsService:
    """Report recorded intent for the owned business without implying physical visits."""

    @staticmethod
    def get_report(
        user,
        period,
    ):
        """Keep missing history nullable and collection coverage explicitly unverified."""
        business = BusinessProfileService.get_business_for_merchant(user)
        totals, started_at, reason = RoutePlanningEventService.get_totals(
            business_id=business.pk,
            owner_id=user.pk,
            period=period,
        )
        reasons = ["best_effort_delivery"]
        if reason:
            reasons.insert(0, reason)
        if (
            started_at is not None
            and period.start < started_at < period.end
        ):
            reasons.append("tracking_started_during_period")
        fields = (
            "total_requests",
            "distinct_explorer_accounts",
            "road_route_requests",
            "jeepney_requests",
        )
        if totals is None:
            counts = {
                field: None
                for field in fields
            }
            availability = "unavailable"
        else:
            counts = {
                field: totals[field]
                for field in fields
            }
            availability = "partial"
        return {
            "business": {
                "id": business.pk,
                "name": business.BUSN_NAME,
                "status": business.BUSN_STATUS,
            },
            **counts,
            "tracking_started_at": started_at,
            "meta": build_meta(
                period,
                availability=availability,
                coverage_verified=False,
                partial_reasons=reasons,
            ),
        }
