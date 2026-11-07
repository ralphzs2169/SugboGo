from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from .serializers import (
    GlobalSearchQuerySerializer,
    GlobalSearchResponseSerializer,
)
from .services import GlobalSearchService


class GlobalSearchView(APIView):
    """Search the existing Admin-visible operational record categories."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN),
    )

    def get(
        self,
        request,
    ):
        """Return bounded record identities after validating search criteria."""
        query = GlobalSearchQuerySerializer(
            data=request.query_params.dict(),
        )
        query.is_valid(
            raise_exception=True,
        )
        results = GlobalSearchService.search(
            **query.validated_data,
        )
        serializer = GlobalSearchResponseSerializer(results)
        return success_response(
            data=serializer.data,
        )
