"""Recorded profile-visit coverage of currently active business inventory."""

from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService
from apps.admin_operations.analytics.services.category_analytics_service import CategoryAnalyticsService
from apps.admin_operations.analytics.services.cluster_analytics_service import ClusterAnalyticsService
from apps.shared.analytics.metadata import build_meta


class CoverageAnalyticsService:
    """Combine eligible SQL populations with recorded visited-business counts."""

    @staticmethod
    def _coverage(eligible, visited):
        """Return null for undefined or unavailable coverage instead of inventing zero."""
        return {
            "eligible_businesses": eligible,
            "visited_businesses": visited,
            "zero_recorded_visit_businesses": eligible - visited if visited is not None else None,
            "coverage_percentage": round(visited / eligible * 100, 2) if eligible and visited is not None else None,
        }

    @classmethod
    def get_report(cls, period, *, cluster=None, category=None):
        """Report pooled and grouped coverage using the same active current population."""
        ids = list(BusinessAttentionService.eligible_businesses(
            cluster=cluster, category=category,
        ).values_list("BUSN_ID", flat=True))
        visibility, visibility_meta = BusinessAttentionService.read_visibility(period, ids)
        visited = [key for key, metrics in visibility.items() if metrics["profile_visits"] > 0] if visibility is not None else None
        clusters = ClusterAnalyticsService.get_coverage_counts(ids, visited, cluster=cluster, category=category)
        categories = CategoryAnalyticsService.get_coverage_counts(ids, visited, cluster=cluster, category=category)
        return {
            "label": "Recorded discovery coverage of currently active businesses",
            "description": "Current status and classification define eligibility; tracking coverage is unverified.",
            "overall": cls._coverage(len(ids), len(visited) if visited is not None else None),
            "clusters": [{"id": row["id"], "name": row["name"], **cls._coverage(row["eligible"], row["visited"])} for row in clusters],
            "categories": [{"id": row["id"], "name": row["name"], **cls._coverage(row["eligible"], row["visited"])} for row in categories],
            "meta": build_meta(
                period, availability="unavailable" if visibility is None else "partial",
                partial_reasons=("current_state_reporting", "visibility_coverage_unverified"),
            ),
            "sources": {
                "domain": build_meta(period, coverage_verified=True, data_through=period.end,
                                     partial_reasons=("current_state_reporting",)),
                "visibility": visibility_meta,
            },
        }
