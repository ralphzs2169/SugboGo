from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination

from ..serializers.vouch_history_serializers import (
    VouchHistoryQuerySerializer,
    VouchHistorySerializer,
)
from ..services.vouch_history_service import VouchHistoryService


class VouchHistoryView(APIView):
    """Returns the authenticated user's paginated active specialty vouches."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Lists current specialty vouches in the requested chronological order."""
        query_serializer = VouchHistoryQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )
        queryset = VouchHistoryService.list_vouches(
            user=request.user,
            **query_serializer.validated_data,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            queryset,
            request,
        )
        serializer = VouchHistorySerializer(
            page,
            many=True,
        )
        return paginator.get_paginated_response(
            serializer.data,
        )
