from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.serializers.category_serializers import (
    CategoryCreateSerializer,
    CategorySerializer,
    CategoryUpdateSerializer,
)
from apps.admin_operations.taxonomy_management.services.category_service import (
    CategoryService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class CategoryListView(APIView):
    """Handle category listing and creation."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),)

    def get(self, request):
        """Retrieve a paginated list of categories."""

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        cluster_id = request.query_params.get("cluster_id")

        queryset = CategoryService.list_categories(
            search=search,
            ordering=ordering,
            cluster_id=cluster_id,
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = CategorySerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a new category."""

        serializer = CategoryCreateSerializer(
            data=request.data,
        )

        serializer.is_valid(raise_exception=True)

        category = CategoryService.create_category(
            serializer.validated_data,
        )

        return success_response(
            data=CategorySerializer(category).data,
            message="Category created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class CategoryDetailView(APIView):
    """Handle retrieval, updating, and deletion of a category."""

    def get(self, request, category_id):
        """Retrieve a specific category."""

        category = CategoryService.get_category(category_id)

        return success_response(
            data=CategorySerializer(category).data,
        )

    def put(self, request, category_id):
        """Fully update a category."""

        return self._update(
            request,
            category_id,
            partial=False,
        )

    def patch(self, request, category_id):
        """Partially update a category."""

        return self._update(
            request,
            category_id,
            partial=True,
        )
    

    def _update(self, request, category_id, partial=False):
        category = CategoryService.get_category(category_id)

        serializer = CategoryUpdateSerializer(
            category,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(raise_exception=True)

        category = CategoryService.update_category(
            category,
            serializer.validated_data,
        )

        return success_response(
            data=CategorySerializer(category).data,
            message="Category updated successfully.",
        )


    def delete(self, request, category_id):
        """Delete a category."""

        category = CategoryService.get_category(category_id)

        CategoryService.delete_category(category)

        return success_response(
            message="Category deleted successfully.",
        )