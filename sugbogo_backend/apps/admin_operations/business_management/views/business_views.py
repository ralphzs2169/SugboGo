from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.serializers import (
    BusinessDetailSerializer,
    BusinessVerifyActionSerializer,
)
from apps.business.services import BusinessService
from apps.users.models import User


class BusinessVerifyView(APIView):
    """UC-12 Review Merchant Registrations (stub). Admin-only."""
    permission_classes = (IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),)

    def patch(self, request, MSME_ID):
        business = BusinessService.get_business(MSME_ID)

        input_serializer = BusinessVerifyActionSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        business = BusinessService.verify_business(
            business,
            action=input_serializer.validated_data["action"],
            reason=input_serializer.validated_data.get("reason", ""),
        )

        output_serializer = BusinessDetailSerializer(business)
        return Response(output_serializer.data, status=status.HTTP_200_OK)