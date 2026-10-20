from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination

from ..serializers.activity_timeline_serializers import (
    ActivityTimelineQuerySerializer,
    ActivityTimelineSerializer,
)
from ..services.activity_timeline_service import ActivityTimelineService


class ActivityTimelineView(APIView):
    """Provides private current activity for authenticated Explorer-mode accounts."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(
        self,
        request,
    ):
        """Validates the filter and paginates the globally ordered activity query."""
        query_serializer = ActivityTimelineQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        queryset = ActivityTimelineService.list_activity(
            user=request.user,
            **query_serializer.validated_data,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            queryset,
            request,
        )
        return paginator.get_paginated_response(
            ActivityTimelineSerializer(page, many=True).data,
        )
