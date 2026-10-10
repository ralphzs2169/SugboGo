from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.notifications.serializers.notification_serializers import (
    NotificationQuerySerializer,
    NotificationResponseSerializer,
)
from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class NotificationListView(APIView):
    """Provide the authenticated active recipient's paginated inbox."""

    permission_classes = (
        IsAuthenticated,
        HasRole(*User.UserRole.values),
    )

    def get(self, request):
        """List recipient notifications using validated read-state filters."""
        query = NotificationQuerySerializer(data=request.query_params.dict())
        query.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            NotificationService.queryset(request.user, **query.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            NotificationResponseSerializer(page, many=True).data,
        )


class NotificationUnreadCountView(APIView):
    """Provide the authenticated recipient's unread badge count."""

    permission_classes = NotificationListView.permission_classes

    def get(self, request):
        """Return the number of unread recipient notifications."""
        return success_response(
            data={"unread_count": NotificationService.unread_count(request.user)},
        )


class NotificationReadView(APIView):
    """Provide an idempotent read operation for a recipient-owned notification."""

    permission_classes = NotificationListView.permission_classes

    def post(self, request, notification_id):
        """Mark an owned notification read without accepting client state fields."""
        notification = NotificationService.mark_read(request.user, notification_id)
        return success_response(
            data=NotificationResponseSerializer(notification).data,
            message="Notification marked as read.",
        )


class NotificationReadAllView(APIView):
    """Provide a recipient-scoped bulk read operation."""

    permission_classes = NotificationListView.permission_classes

    def post(self, request):
        """Mark the recipient's unread items read and report the updated count."""
        return success_response(
            data={"updated_count": NotificationService.mark_all_read(request.user)},
            message="Notifications marked as read.",
        )
