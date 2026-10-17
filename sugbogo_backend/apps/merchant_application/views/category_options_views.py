from core.responses import success_response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.serializers.category_serializers import (
    CategorySerializer,
)
from apps.admin_operations.taxonomy_management.services.category_service import (
    CategoryService,
)


class CategoryOptionsView(APIView):
    """Handle category options for registration forms."""

    permission_classes = (AllowAny,)

    def get(self, request):
        categories = CategoryService.list_categories()

        serializer = CategorySerializer(
            categories,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Categories retrieved successfully.",
        )