from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.cluster_discovery_shortcut_serializers import (
    ClusterDiscoveryShortcutSerializer,
)
from apps.explorer_operations.explore_businesses.services.cluster_discovery_shortcut_service import (
    ClusterDiscoveryShortcutService,
)
from apps.users.models import User
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class ClusterDiscoveryShortcutView(APIView):
    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        shortcuts = ClusterDiscoveryShortcutService.list_active_shortcuts()

        serializer = ClusterDiscoveryShortcutSerializer(
            shortcuts,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Discovery shortcuts retrieved successfully.",
        )