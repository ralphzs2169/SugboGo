from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination

from ..serializers.map_discovery_serializers import (
    MapDiscoveryBusinessSerializer,
    MapDiscoveryQuerySerializer,
    MapDirectoryQuerySerializer,
)
from ..services.map_discovery_service import MapDiscoveryService


class MapDiscoveryPagination(StandardPagination):
    """Bound each marker page while retaining the standard total and has-next metadata."""

    def __init__(self):
        """Read the marker cap at request time, including deployment overrides."""
        super().__init__()
        self.page_size = settings.MAP_DISCOVERY_MAX_MARKERS
        self.max_page_size = settings.MAP_DISCOVERY_MAX_MARKERS


class MapDiscoveryView(APIView):
    """Serve compact business markers inside a validated Explorer map viewport."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    query_serializer_class = MapDiscoveryQuerySerializer
    list_businesses = staticmethod(MapDiscoveryService.list_viewport_businesses)

    def get(
        self,
        request,
    ):
        """Return one bounded marker page with global Hidden Gem indicators."""
        query_serializer = self.query_serializer_class(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        businesses = self.list_businesses(
            **query_serializer.validated_data,
        )
        paginator = MapDiscoveryPagination()
        page = paginator.paginate_queryset(
            businesses,
            request,
        )
        serializer = MapDiscoveryBusinessSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )


class MapDirectoryView(MapDiscoveryView):
    """Serve every eligible map business through bounded, deterministic pages."""

    query_serializer_class = MapDirectoryQuerySerializer
    list_businesses = staticmethod(MapDiscoveryService.list_directory_businesses)
