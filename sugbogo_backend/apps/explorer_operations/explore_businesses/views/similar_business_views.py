from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from ..serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
)
from ..services.similar_business_service import (
    SimilarBusinessService,
)
from apps.users.models import User
from core.responses import success_response


class SimilarBusinessView(APIView):
    """Return compact taxonomy-similar places for a business profile."""

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
        business_id,
    ):
        businesses = SimilarBusinessService.list_similar_businesses(
            business_id,
            request.user,
        )
        serializer = ExploreBusinessSerializer(
            businesses,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Similar businesses retrieved successfully.",
        )
