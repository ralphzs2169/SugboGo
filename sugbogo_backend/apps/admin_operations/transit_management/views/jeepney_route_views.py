from rest_framework import status
from rest_framework.views import APIView

from apps.admin_operations.transit_management.serializers.jeepney_route_serializers import (
    JeepneyRouteDetailSerializer,
    JeepneyRouteSerializer,
    JeepneyRouteWriteSerializer,
)
from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.views import ADMIN_PERMISSIONS
from core.pagination import StandardPagination
from core.responses import success_response


class JeepneyRouteListView(APIView):
    """Handle administrator route listing and creation."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request):
        """Retrieve a paginated list of jeepney routes."""

        routes = JeepneyRouteService.list_routes(
            search=request.query_params.get("search"),
            ordering=request.query_params.get("ordering"),
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            routes,
            request,
        )

        serializer = JeepneyRouteSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a jeepney route."""

        serializer = JeepneyRouteWriteSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        route = JeepneyRouteService.create_route(
            serializer.validated_data,
        )
        route = JeepneyRouteService.get_route(
            route.JRT_ID,
        )

        return success_response(
            data=JeepneyRouteDetailSerializer(route).data,
            message="Jeepney route created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class JeepneyRouteDetailView(APIView):
    """Handle administrator route retrieval and updates."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request, route_id):
        """Retrieve a jeepney route and its variants."""

        route = JeepneyRouteService.get_route(
            route_id,
        )

        return success_response(
            data=JeepneyRouteDetailSerializer(route).data,
            message="Jeepney route retrieved successfully.",
        )

    def put(self, request, route_id):
        """Fully update a jeepney route."""

        return self._update(
            request,
            route_id,
            partial=False,
        )

    def patch(self, request, route_id):
        """Partially update a jeepney route."""

        return self._update(
            request,
            route_id,
            partial=True,
        )

    def _update(
        self,
        request,
        route_id,
        partial,
    ):
        """Validate and persist a route update."""

        route = JeepneyRouteService.get_route(
            route_id,
        )

        serializer = JeepneyRouteWriteSerializer(
            route,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        JeepneyRouteService.update_route(
            route_id,
            serializer.validated_data,
        )
        route = JeepneyRouteService.get_route(
            route_id,
        )

        return success_response(
            data=JeepneyRouteDetailSerializer(route).data,
            message="Jeepney route updated successfully.",
        )
