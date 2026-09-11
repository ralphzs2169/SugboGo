from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.discovery_feed_serializer import (
    DiscoveryFeedQuerySerializer,
)
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.users.models import User
from core.pagination import StandardPagination


class DiscoveryFeedView(APIView):
    """Handles the Discovery Score ranked Explorer business feed."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Returns one paginated page of ranked active businesses."""

        query_serializer = DiscoveryFeedQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        queryset = DiscoveryFeedService.list_discovery_businesses(
            user=request.user,
            search=query_serializer.validated_data.get(
                "search",
                "",
            ),
            category_ids=query_serializer.validated_data.get(
                "category",
            ),
            cluster_id=query_serializer.validated_data.get(
                "cluster",
            ),
            specialty_tag_id=query_serializer.validated_data.get(
                "specialty_tag",
            ),
        )

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
