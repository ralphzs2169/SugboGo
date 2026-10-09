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
    """Returns business-grouped vouch history with totals for the authenticated user."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Paginates eligible businesses and returns their endorsements and full totals."""
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
        response = paginator.get_paginated_response(
            serializer.data,
        )
        response.data["data"]["summary"] = VouchHistoryService.get_summary(
            request.user,
        )
        return response
