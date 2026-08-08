from core.responses import success_response
from rest_framework.views import APIView

from apps.msme.serializers.category_serializers import CategorySerializer
from apps.msme.services.category_service import CategoryService


class CategoryOptionsView(APIView):
    """Handle category options for registration forms."""

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