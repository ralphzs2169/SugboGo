from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.admin_operations.analytics.serializers.discovery_score_serializers import (
    AdminDiscoveryScoreSerializer,
)
from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)
from apps.admin_operations.analytics.serializers.platform_analytics_serializers import (
    AnalyticsPeriodQuerySerializer,
    DiscoveryTrendQuerySerializer,
    DiscoveryTrendSerializer,
    PlatformAnalyticsSerializer,
)
from apps.admin_operations.analytics.services.discovery_analytics_service import (
    DiscoveryAnalyticsService,
)
from apps.admin_operations.analytics.services.platform_analytics_service import (
    PlatformAnalyticsService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)])
def get_analytics_data(request):
    """Return current platform inventory and selected-period account/discovery activity."""
    query = AnalyticsPeriodQuerySerializer(data=request.query_params)
    query.is_valid(raise_exception=True)
    report = PlatformAnalyticsService.get_overview(query.validated_data["report_period"])
    return success_response(
        data=PlatformAnalyticsSerializer(report).data,
        message="Platform analytics retrieved successfully.",
    )


class DiscoveryTrendView(APIView):
    """Provide one selectable discovery trend to active administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Validate the selected metric and return aggregate visibility observations."""
        query = DiscoveryTrendQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = DiscoveryAnalyticsService.get_report(
            query.validated_data["report_period"],
            metric=query.validated_data["metric"],
            interval=query.validated_data["interval"],
        )
        return success_response(
            data=DiscoveryTrendSerializer(report).data,
            message="Discovery trend retrieved successfully.",
        )


class DiscoveryScoreListView(APIView):
    """List current persisted Discovery Scores for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Return a filtered and paginated score list."""

        queryset = DiscoveryScoreMonitoringService.list_scores(
            search=request.query_params.get("search"),
            status=request.query_params.get("status"),
            cluster=request.query_params.get("cluster"),
            category=request.query_params.get("category"),
            specialty_tag=request.query_params.get("specialty_tag"),
            ordering=request.query_params.get("ordering"),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = AdminDiscoveryScoreSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class DiscoveryScoreRecomputeView(APIView):
    """Trigger the existing batch recomputation for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def post(self, request):
        """Recompute scores and return a safe batch summary."""

        summary = DiscoveryScoreMonitoringService.recompute_scores()
        return success_response(
            data=summary,
            message="Discovery Scores recomputed successfully.",
        )
