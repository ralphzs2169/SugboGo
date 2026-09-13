from rest_framework import status
from rest_framework.views import APIView

from apps.admin_operations.transit_management.serializers.transit_point_serializers import (
    TransitPointSerializer,
    TransitPointWriteSerializer,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.admin_operations.transit_management.views import ADMIN_PERMISSIONS
from core.pagination import StandardPagination
from core.responses import success_response


class TransitPointListView(APIView):
    """Handle administrator Transit Point listing and creation."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request):
        """Retrieve a paginated list of Transit Points."""

        transit_points = TransitPointService.list_transit_points(
            search=request.query_params.get("search"),
            ordering=request.query_params.get("ordering"),
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            transit_points,
            request,
        )

        serializer = TransitPointSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a Transit Point from latitude and longitude."""

        serializer = TransitPointWriteSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        transit_point = TransitPointService.create_transit_point(
            serializer.validated_data,
        )

        return success_response(
            data=TransitPointSerializer(transit_point).data,
            message="Transit Point created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class TransitPointDetailView(APIView):
    """Handle administrator Transit Point retrieval and updates."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request, transit_point_id):
        """Retrieve a Transit Point."""

        transit_point = TransitPointService.get_transit_point(
            transit_point_id,
        )

        return success_response(
            data=TransitPointSerializer(transit_point).data,
            message="Transit Point retrieved successfully.",
        )

    def put(self, request, transit_point_id):
        """Fully update a Transit Point."""

        return self._update(
            request,
            transit_point_id,
            partial=False,
        )

    def patch(self, request, transit_point_id):
        """Partially update a Transit Point."""

        return self._update(
            request,
            transit_point_id,
            partial=True,
        )

    def _update(
        self,
        request,
        transit_point_id,
        partial,
    ):
        """Validate and persist a Transit Point update."""

        transit_point = TransitPointService.get_transit_point(
            transit_point_id,
        )

        serializer = TransitPointWriteSerializer(
            transit_point,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        transit_point = TransitPointService.update_transit_point(
            transit_point_id,
            serializer.validated_data,
        )

        return success_response(
            data=TransitPointSerializer(transit_point).data,
            message="Transit Point updated successfully.",
        )
