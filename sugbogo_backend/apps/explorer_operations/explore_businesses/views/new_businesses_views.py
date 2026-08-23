from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
)
from apps.explorer_operations.explore_businesses.services.new_businesses_service import (
    NewBusinessesService,
)
from apps.users.models import User
from core.pagination import StandardPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class NewBusinessesView(APIView):
    """Handle newly added business listings for Explorer."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )
    
    def get(self, request):
        """Retrieve a paginated list of newly added active businesses."""

        queryset = NewBusinessesService.list_new_businesses()

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = ExploreBusinessSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )