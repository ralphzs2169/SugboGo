"""GET-only Admin views for advisory vouch monitoring."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.suspicious_vouch_serializers import (
    SuspiciousVouchDetailSerializer,
    SuspiciousVouchFilterSerializer,
    SuspiciousVouchListSerializer,
)
from apps.admin_operations.moderation.services.suspicious_vouch_service import (
    SuspiciousVouchService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class AdminSuspiciousVouchListView(APIView):
    """Lists flagged submissions without any enforcement actions."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ),
    )

    def get(
        self,
        request,
    ):
        """Returns filtered, joined vouch rows in the standard page envelope."""
        filters = SuspiciousVouchFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            SuspiciousVouchService.list_vouches(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            SuspiciousVouchListSerializer(page, many=True).data,
        )


class AdminSuspiciousVouchDetailView(APIView):
    """Shows original findings alongside current support context."""

    permission_classes = AdminSuspiciousVouchListView.permission_classes

    def get(
        self,
        request,
        vouch_id,
    ):
        """Returns a flagged vouch and bounded related submissions."""
        vouch = SuspiciousVouchService.get_vouch(vouch_id)
        related = SuspiciousVouchService.related_vouches(vouch)
        return success_response(
            data=SuspiciousVouchDetailSerializer(
                vouch,
                context={"related_vouches": related},
            ).data,
            message="Suspicious vouch retrieved successfully.",
        )
