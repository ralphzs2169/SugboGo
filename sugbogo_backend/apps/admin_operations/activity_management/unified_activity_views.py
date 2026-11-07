"""Read-only, role-protected unified activity APIs."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

from .unified_activity_serializers import (
    UnifiedActivityDetailSerializer,
    UnifiedActivityQuerySerializer,
    UnifiedActivitySerializer,
)
from .unified_activity_service import UnifiedActivityService


ACTIVITY_PERMISSIONS = (
    IsAuthenticated,
    HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
)


class UnifiedActivityListView(APIView):
    """List retained source occurrences with validated filters and SQL pagination."""

    permission_classes = ACTIVITY_PERMISSIONS

    def get(
        self,
        request,
    ):
        """Return the standard paginated envelope without reading unrequested pages into memory."""
        query = UnifiedActivityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        activities = UnifiedActivityService.list_activity(
            **query.validated_data,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            activities,
            request,
            view=self,
        )
        serializer = UnifiedActivitySerializer(
            page,
            many=True,
            context={
                "current_actors": UnifiedActivityService.resolve_current_actors(page),
            },
        )
        return paginator.get_paginated_response(serializer.data)


class UnifiedActivityDetailView(APIView):
    """Retrieve one retained, deduplicated occurrence through its composite identity."""

    permission_classes = ACTIVITY_PERMISSIONS

    def get(
        self,
        request,
        event_id,
    ):
        """Return normalized facts and explicitly allowlisted historical detail."""
        activity = UnifiedActivityService.get_activity(event_id)
        serializer = UnifiedActivityDetailSerializer(
            activity,
            context={
                "current_actors": UnifiedActivityService.resolve_current_actors([activity]),
            },
        )
        return success_response(data=serializer.data)
