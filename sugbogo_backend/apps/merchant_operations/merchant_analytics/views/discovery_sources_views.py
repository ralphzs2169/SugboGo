from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response
from ..serializers.discovery_sources_serializers import (
    DiscoverySourcesQuerySerializer,
    DiscoverySourcesSerializer,
)
from ..services.discovery_sources_service import DiscoverySourcesService


class DiscoverySourcesView(APIView):
    """Serve owned-business source counts without consulting Plus entitlement."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def get(
        self,
        request,
    ):
        """Capture a single Manila reporting cutoff and return nullable source data."""
        query = DiscoverySourcesQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = DiscoverySourcesService.get_report(
            request.user,
            query.validated_data["report_period"],
        )
        return success_response(
            data=DiscoverySourcesSerializer(report).data,
            message="Discovery-source analytics retrieved successfully.",
        )
