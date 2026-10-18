"""Administrator access to geographic listing-engagement evidence."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.analytics.serializers.discovery_heatmap_serializers import (
    DiscoveryHeatmapQuerySerializer,
    DiscoveryHeatmapSerializer,
)
from apps.admin_operations.analytics.services.discovery_heatmap_service import DiscoveryHeatmapService
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class DiscoveryHeatmapView(APIView):
    """Provide a read-only geographic report to active administrators."""

    permission_classes = (
        IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Validate filters and return one source-aware map/table dataset."""
        query = DiscoveryHeatmapQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        report = DiscoveryHeatmapService.get_report(
            values["report_period"], cluster=values.get("cluster"),
            category=values.get("category"), cell=values.get("cell"),
        )
        return success_response(
            data=DiscoveryHeatmapSerializer(report).data,
            message="Discovery heatmap retrieved successfully.",
        )
