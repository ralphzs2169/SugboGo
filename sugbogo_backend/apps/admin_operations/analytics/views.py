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
from apps.admin_operations.analytics.serializers.coverage_attention_serializers import (
    BusinessAttentionMetadataSerializer,
    BusinessAttentionQuerySerializer,
    BusinessAttentionRowSerializer,
    CoverageQuerySerializer,
    CoverageReportSerializer,
    LowExposureQuerySerializer,
)
from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService
from apps.admin_operations.analytics.services.coverage_analytics_service import CoverageAnalyticsService
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


class CoverageAnalyticsView(APIView):
    """Provide pooled and grouped recorded coverage to active administrators."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN))

    def get(self, request):
        """Validate classification filters and return source-aware coverage counts."""
        query = CoverageQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        report = CoverageAnalyticsService.get_report(
            values["report_period"], cluster=values.get("cluster"), category=values.get("category"),
        )
        return success_response(data=CoverageReportSerializer(report).data, message="Coverage analytics retrieved successfully.")


class BusinessAttentionView(APIView):
    """Provide globally sorted and then paginated administrator attention rows."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN))
    query_serializer = BusinessAttentionQuerySerializer
    low_exposure = False

    def get(self, request):
        """Return standard pagination or explicit unavailability for source-dependent ordering."""
        query = self.query_serializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        report = BusinessAttentionService.get_report(
            values["report_period"], cluster=values.get("cluster"), category=values.get("category"),
            ordering=values["ordering"], low_exposure=self.low_exposure,
        )
        metadata = BusinessAttentionMetadataSerializer(report).data
        if report["items"] is None:
            return success_response(
                data={"items": None, "pagination": None, **metadata},
                message="Business attention is temporarily unavailable.",
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(report["items"], request, view=self)
        response = paginator.get_paginated_response(BusinessAttentionRowSerializer(page, many=True).data)
        response.data["data"].update(metadata)
        return response


class LowExposureView(BusinessAttentionView):
    """Provide provisional recorded-low-attention candidates using the fixed admin policy."""

    query_serializer = LowExposureQuerySerializer
    low_exposure = True


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
