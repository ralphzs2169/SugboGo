from core.responses import success_response
from rest_framework.decorators import api_view

from apps.msme.serializers.category_serializers import (
    CategoryCreateSerializer,
    CategorySerializer,
    CategoryUpdateSerializer,
)
from apps.msme.services.category_service import CategoryService


@api_view(["GET"])
def list_categories(request):
    """Retrieve a list of all categories."""
    categories = CategoryService.list_categories()
    serializer = CategorySerializer(categories, many=True)

    return success_response(data=serializer.data)


@api_view(["GET"])
def retrieve_category(request, category_id):
    """Retrieve a specific category by ID."""
    category = CategoryService.get_category(category_id)
    serializer = CategorySerializer(category)

    return success_response(data=serializer.data)


@api_view(["POST"])
def create_category(request):
    """Create a new category."""
    serializer = CategoryCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    category = CategoryService.create_category(serializer.validated_data)

    return success_response(
        data=CategorySerializer(category).data,
        message="Category created successfully.",
        status_code=201,
    )


@api_view(["PUT", "PATCH"])
def update_category(request, category_id):
    serializer = CategoryUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    category = CategoryService.get_category(category_id)

    category = CategoryService.update_category(
        category,
        serializer.validated_data,
    )

    return success_response(
        data=CategorySerializer(category).data,
        message="Category updated successfully.",
    )


@api_view(["DELETE"])
def delete_category(request, category_id):
    category = CategoryService.get_category(category_id)

    CategoryService.delete_category(category)

    return success_response(
        message="Category deleted successfully.",
    )