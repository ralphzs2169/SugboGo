from core.pagination import StandardPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.business_management.services.application_service import (
    ApplicationService,
)
from apps.authentication.permissions import HasRole
from apps.merchant_application.serializers.application_serializers import (
    MerchantApplicationListSerializer,
)
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

        serializer = MerchantApplicationListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )