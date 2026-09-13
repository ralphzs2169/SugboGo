from rest_framework import status
from rest_framework.views import APIView

from apps.admin_operations.transit_management.serializers.route_variant_serializers import (
    JeepneyRouteVariantSerializer,
    JeepneyRouteVariantWriteSerializer,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.views import ADMIN_PERMISSIONS
from core.pagination import StandardPagination
from core.responses import success_response


class JeepneyRouteVariantListView(APIView):
    """Handle administrator variant listing and creation."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request):
        """Retrieve a paginated list of directional variants."""

        variants = RouteVariantService.list_variants(
            route_id=request.query_params.get("route_id"),
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            variants,
            request,
        )

        serializer = JeepneyRouteVariantSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a variant and its ordered points atomically."""

        serializer = JeepneyRouteVariantWriteSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        variant = RouteVariantService.create_variant(
            serializer.validated_data,
        )

        return success_response(
            data=JeepneyRouteVariantSerializer(variant).data,
            message="Jeepney route variant created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class JeepneyRouteVariantDetailView(APIView):
    """Handle administrator variant retrieval and coherent updates."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request, variant_id):
        """Retrieve a directional route variant."""

        variant = RouteVariantService.get_variant(
            variant_id,
        )

        return success_response(
            data=JeepneyRouteVariantSerializer(variant).data,
            message="Jeepney route variant retrieved successfully.",
        )

    def put(self, request, variant_id):
        """Fully replace a route variant definition."""

        return self._update(
            request,
            variant_id,
            partial=False,
        )

    def patch(self, request, variant_id):
        """Partially update a route variant definition."""

        return self._update(
            request,
            variant_id,
            partial=True,
        )

    def _update(
        self,
        request,
        variant_id,
        partial,
    ):
        """Validate and persist a coherent variant update."""

        variant = RouteVariantService.get_variant(
            variant_id,
        )

        serializer = JeepneyRouteVariantWriteSerializer(
            variant,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        variant = RouteVariantService.update_variant(
            variant_id,
            serializer.validated_data,
        )

        return success_response(
            data=JeepneyRouteVariantSerializer(variant).data,
            message="Jeepney route variant updated successfully.",
        )
