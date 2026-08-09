from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.taxonomy_management.serializers.specialty_tag_serializers import (
    SpecialtyTagCreateSerializer,
    SpecialtyTagSerializer,
    SpecialtyTagUpdateSerializer,
)
from apps.admin_operations.taxonomy_management.services.specialty_tag_service import (
    SpecialtyTagService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


class SpecialtyTagListView(APIView):
    """Handle specialty tag listing and creation."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve a paginated list of specialty tags."""

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")

        queryset = SpecialtyTagService.list_specialty_tags(
            search=search,
            ordering=ordering,
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = SpecialtyTagSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a new specialty tag."""

        serializer = SpecialtyTagCreateSerializer(
            data=request.data,
        )

        serializer.is_valid(raise_exception=True)

        specialty_tag = SpecialtyTagService.create_specialty_tag(
            serializer.validated_data,
        )

        return success_response(
            data=SpecialtyTagSerializer(specialty_tag).data,
            message="Specialty tag created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class SpecialtyTagDetailView(APIView):
    """Handle retrieval, updating, and deletion of a specialty tag."""

    def get(self, request, tag_id):
        """Retrieve a specific specialty tag."""

        specialty_tag = SpecialtyTagService.get_specialty_tag(tag_id)

        return success_response(
            data=SpecialtyTagSerializer(specialty_tag).data,
        )

    def put(self, request, tag_id):
        """Fully update a specialty tag."""

        return self._update(
            request,
            tag_id,
            partial=False,
        )

    def patch(self, request, tag_id):
        """Partially update a specialty tag."""

        return self._update(
            request,
            tag_id,
            partial=True,
        )

    def _update(self, request, tag_id, partial=False):
        specialty_tag = SpecialtyTagService.get_specialty_tag(tag_id)

        serializer = SpecialtyTagUpdateSerializer(
            specialty_tag,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(raise_exception=True)

        specialty_tag = SpecialtyTagService.update_specialty_tag(
            specialty_tag,
            serializer.validated_data,
        )

        return success_response(
            data=SpecialtyTagSerializer(specialty_tag).data,
            message="Specialty tag updated successfully.",
        )

    def delete(self, request, tag_id):
        """Delete a specialty tag."""

        specialty_tag = SpecialtyTagService.get_specialty_tag(tag_id)

        SpecialtyTagService.delete_specialty_tag(specialty_tag)

        return success_response(
            message="Specialty tag deleted successfully.",
        )