from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User

from .serializers import (
    MsmeListSerializer,
    MsmeDetailSerializer,
    MsmeVerifyActionSerializer,
)
from .services import MsmeService


class MsmeListView(generics.ListAPIView):
    """UC-02 Browse MSMEs (stub). Any authenticated role."""
    serializer_class = MsmeListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MsmeService.list_msmes(
            search=self.request.query_params.get("search"),
            ordering=self.request.query_params.get("ordering"),
            category_id=self.request.query_params.get("category_id"),
            cluster_id=self.request.query_params.get("cluster_id"),
        )


class MsmeDetailView(generics.RetrieveAPIView):
    """UC-02 View MSME Profile (stub). Any authenticated role."""
    serializer_class = MsmeDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return MsmeService.get_msme(self.kwargs["MSME_ID"])


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