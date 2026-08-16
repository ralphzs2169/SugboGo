from core.pagination import StandardPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.serializers.manage_business_serializers import (
    AdminBusinessListSerializer,
)
from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class BusinessListView(APIView):
    """Handle business listing for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve a paginated list of businesses."""

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        status_filter = request.query_params.get("status")

        queryset = BusinessService.list_businesses(
            search=search,
            ordering=ordering,
            status=status_filter,
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = AdminBusinessListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )