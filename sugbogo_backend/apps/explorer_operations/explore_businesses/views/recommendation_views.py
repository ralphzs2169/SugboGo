from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    RecommendationBusinessSerializer,
)
from apps.explorer_operations.explore_businesses.services.recommendation_service import (
    RecommendationService,
)
from apps.users.models import User
from core.pagination import StandardPagination


class RecommendationView(APIView):
    """Returns one page of backend-ranked recommendations."""

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
    ):
        """Paginate the complete ranking before hydrating response businesses."""

        result = RecommendationService.get_recommendation_ranking(
            request.user,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            result.businesses,
            request,
        )
        businesses = RecommendationService.hydrate_recommendations(
            user=request.user,
            businesses=page,
            ranking=result,
        )
        serializer = RecommendationBusinessSerializer(
            businesses,
            many=True,
        )

        response = paginator.get_paginated_response(
            serializer.data,
        )
        response.data["data"]["is_personalized"] = result.is_personalized
        return response
