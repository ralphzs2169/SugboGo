from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..serializers.explore_business_serializer import ExploreBusinessSerializer
from ..serializers.open_now_businesses_serializers import (
    OpenNowBusinessesQuerySerializer,
)
from ..services.open_now_businesses_service import OpenNowBusinessesService


class OpenNowBusinessesView(APIView):
    """Serve a fixed preview of nearby businesses open according to listed hours."""

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
        """Return at most six eligible businesses in their server-ranked order."""
        query_serializer = OpenNowBusinessesQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )
        businesses = OpenNowBusinessesService.list_open_now_businesses(
            user=request.user,
            **query_serializer.validated_data,
        )
        serializer = ExploreBusinessSerializer(
            businesses,
            many=True,
        )

        return success_response(
            data=serializer.data,
        )
