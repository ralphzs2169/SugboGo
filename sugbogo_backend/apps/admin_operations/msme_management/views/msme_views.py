from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.msme.serializers import (
    MsmeDetailSerializer,
    MsmeVerifyActionSerializer,
)
from apps.msme.services import MsmeService
from apps.users.models import User


class MsmeVerifyView(APIView):
    """UC-12 Review Merchant Registrations (stub). Admin-only."""
    permission_classes = [IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)]

    def patch(self, request, MSME_ID):
        msme = MsmeService.get_msme(MSME_ID)

        input_serializer = MsmeVerifyActionSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        msme = MsmeService.verify_msme(
            msme,
            action=input_serializer.validated_data["action"],
            reason=input_serializer.validated_data.get("reason", ""),
        )

        output_serializer = MsmeDetailSerializer(msme)
        return Response(output_serializer.data, status=status.HTTP_200_OK)