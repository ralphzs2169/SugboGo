from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.manage_application_serializers import (
    AdminMerchantApplicationDetailSerializer,
    AdminMerchantApplicationListSerializer,
)
from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class MerchantApplicationListView(APIView):
    """Handle merchant application listing for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve a paginated list of merchant applications."""

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        status_filter = request.query_params.get("status")

        queryset = ApplicationService.list_applications(
            search=search,
            ordering=ordering,
            status=status_filter,
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = AdminMerchantApplicationListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )


class MerchantApplicationDetailView(APIView):
    """Handle administrator access to a merchant application for review."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request, application_id):
        """Retrieve the complete application for administrative review."""

        application = ApplicationService.get_application_for_review(
            application_id,
        )

        serializer = AdminMerchantApplicationDetailSerializer(
            application,
        )

        return success_response(
            data=serializer.data,
            message="Application retrieved successfully.",
        )