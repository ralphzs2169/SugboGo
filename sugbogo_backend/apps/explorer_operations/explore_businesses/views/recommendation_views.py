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

    def get(self, request):
        businesses = RecommendationService.list_recommendations(
            request.user,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            businesses,
            request,
        )
        serializer = RecommendationBusinessSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )
