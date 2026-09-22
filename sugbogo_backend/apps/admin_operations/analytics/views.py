from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.admin_operations.analytics.serializers.discovery_score_serializers import (
    AdminDiscoveryScoreSerializer,
)
from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)])
def get_analytics_data(request):
    return Response({
        "message": "Get Analytics Data endpoint"
    })


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
