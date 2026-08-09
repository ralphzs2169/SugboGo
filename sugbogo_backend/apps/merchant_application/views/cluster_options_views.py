from core.responses import success_response
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.serializers.cluster_serializers import (
    ClusterSerializer,
)
from apps.admin_operations.taxonomy_management.services.cluster_service import (
    ClusterService,
)


class ClusterOptionsView(APIView):
    """Handle cluster options for registration forms."""

    def get(self, request):
        clusters = ClusterService.list_registration_options()

        serializer = ClusterSerializer(
            clusters,
            many=True,
        )

        return success_response(
            data=serializer.data,
        )