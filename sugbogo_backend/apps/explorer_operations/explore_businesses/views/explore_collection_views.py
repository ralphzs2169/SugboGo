from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from ..serializers.discovery_feed_serializer import (
    TaxonomyFilterQuerySerializer,
)
from ..serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
    RecommendationBusinessSerializer,
)
from ..services.discovery_feed_service import DiscoveryFeedService
from ..services.new_businesses_service import NewBusinessesService
from ..services.recommendation_service import RecommendationService


class ExploreCollectionView(APIView):
    """Return one filtered page from a ranked Explore collection."""

    HIDDEN_GEMS = "hidden-gems"
    INTERESTS = "interests"
    NEW_BUSINESSES = "new-businesses"

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(
        self,
        request,
        collection_type,
    ):
        query_serializer = TaxonomyFilterQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )
        filters = {
            "category_ids": query_serializer.validated_data.get(
                "category",
            ),
            "cluster_id": query_serializer.validated_data.get(
                "cluster",
            ),
            "specialty_tag_id": query_serializer.validated_data.get(
                "specialty_tag",
            ),
        }

        if collection_type == self.HIDDEN_GEMS:
            businesses = DiscoveryFeedService.list_hidden_gems(
                user=request.user,
                **filters,
            )
            serializer_class = ExploreBusinessSerializer
        elif collection_type == self.INTERESTS:
            businesses = RecommendationService.list_recommendation_collection(
                user=request.user,
                **filters,
            )
            serializer_class = RecommendationBusinessSerializer
        elif collection_type == self.NEW_BUSINESSES:
            businesses = NewBusinessesService.list_new_businesses(
                user=request.user,
                **filters,
            )
            serializer_class = ExploreBusinessSerializer
        else:
            raise NotFound(
                "The Explore collection could not be found.",
            )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            businesses,
            request,
        )
        serializer = serializer_class(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )
