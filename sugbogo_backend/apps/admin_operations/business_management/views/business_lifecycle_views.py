"""Administrative lifecycle commands, status snapshots, and paginated history."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.business_lifecycle_serializers import (
    BusinessStatusSerializer,
    BusinessSuspendSerializer,
    BusinessTransitionHistorySerializer,
    BusinessTransitionSerializer,
)
from apps.admin_operations.business_management.services.business_lifecycle_service import (
    BusinessLifecycleService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class BusinessStatusView(APIView):
    """Provide Admin and Super Admin users with an authoritative dialog precondition."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
        business_id,
    ):
        """Read status and the latest business-specific transition identity."""
        result = BusinessLifecycleService.status(
            actor=request.user,
            business_id=business_id,
        )
        return success_response(
            data=BusinessStatusSerializer(result).data,
            message="Business status retrieved successfully.",
        )


class BusinessSuspendView(BusinessStatusView):
    """Accept only validated suspension commands rather than arbitrary status updates."""

    http_method_names = ["post", "options"]
    input_serializer = BusinessSuspendSerializer
    suspend = True

    def post(
        self,
        request,
        business_id,
    ):
        """Persist one authorized transition with its audit record and merchant notice."""
        serializer = self.input_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = BusinessLifecycleService.transition(
            actor=request.user,
            business_id=business_id,
            suspend=self.suspend,
            **serializer.validated_data,
        )
        return success_response(
            data=BusinessStatusSerializer(result).data,
            message="Business status updated successfully.",
        )


class BusinessReactivateView(BusinessSuspendView):
    """Restore only a suspended business without changing its owner account."""

    input_serializer = BusinessTransitionSerializer
    suspend = False


class BusinessStatusHistoryView(BusinessStatusView):
    """Provide only authorized business-specific transition history."""

    def get(
        self,
        request,
        business_id,
    ):
        """Paginate the preserved audit events without returning arbitrary JSON context."""
        BusinessLifecycleService.require_admin(request.user)
        BusinessLifecycleService.get_business(business_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            BusinessLifecycleService.history(business_id),
            request,
        )
        return paginator.get_paginated_response(
            BusinessTransitionHistorySerializer(page, many=True).data,
        )
