from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.msme.serializers import (
    MsmeDetailSerializer,
    MsmeListSerializer,
)
from apps.msme.services import MsmeService


class MsmeListView(generics.ListAPIView):
    """UC-02 Browse MSMEs (stub). Any authenticated role."""
    serializer_class = MsmeListSerializer
    permission_classes = (IsAuthenticated,)

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
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return MsmeService.get_msme(self.kwargs["MSME_ID"])


