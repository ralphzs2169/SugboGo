from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.serializers.discovery_shortcut_serializers import (
    ClusterDiscoveryShortcutSerializer,
    ClusterDiscoveryShortcutWriteSerializer,
)
from apps.admin_operations.taxonomy_management.services.cluster_discovery_shortcut_service import (
    ClusterDiscoveryShortcutAdminService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class ClusterDiscoveryShortcutListView(APIView):
    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )
 

    def get(self, request):
        """Retrieve a paginated list of discovery shortcuts."""

        queryset = ClusterDiscoveryShortcutAdminService.list_shortcuts(
            search=request.query_params.get("search"),
            ordering=request.query_params.get("ordering"),
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ClusterDiscoveryShortcutSerializer(page, many=True)

        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """Create a new cluster discovery shortcut."""

        serializer = ClusterDiscoveryShortcutWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shortcut = ClusterDiscoveryShortcutAdminService.create_shortcut(
            serializer.validated_data,
        )

        return success_response(
            message="Discovery Shortcut created successfully.",
            data=ClusterDiscoveryShortcutSerializer(shortcut).data,
            status_code=status.HTTP_201_CREATED,
        )


class ClusterDiscoveryShortcutDetailView(APIView):
    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def patch(self, request, shortcut_id):
        """Partially update a cluster discovery shortcut."""

        shortcut = ClusterDiscoveryShortcutAdminService.get_shortcut(shortcut_id)
        serializer = ClusterDiscoveryShortcutWriteSerializer(
            shortcut,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        shortcut = ClusterDiscoveryShortcutAdminService.update_shortcut(
            shortcut,
            serializer.validated_data,
        )

        return success_response(
            message="Discovery Shortcut updated successfully.",
            data=ClusterDiscoveryShortcutSerializer(shortcut).data,
        )

    def put(self, request, shortcut_id):
        """Fully update a cluster discovery shortcut."""

        shortcut = ClusterDiscoveryShortcutAdminService.get_shortcut(shortcut_id)
        serializer = ClusterDiscoveryShortcutWriteSerializer(
            shortcut,
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)
        shortcut = ClusterDiscoveryShortcutAdminService.update_shortcut(
            shortcut,
            serializer.validated_data,
        )

        return success_response(
            message="Discovery Shortcut updated successfully.",
            data=ClusterDiscoveryShortcutSerializer(shortcut).data,
        )

    def delete(self, request, shortcut_id):
        """Delete a cluster discovery shortcut."""
        
        shortcut = ClusterDiscoveryShortcutAdminService.get_shortcut(shortcut_id)
        ClusterDiscoveryShortcutAdminService.delete_shortcut(shortcut)

        return success_response(
            message="Discovery Shortcut deleted successfully."
        )
