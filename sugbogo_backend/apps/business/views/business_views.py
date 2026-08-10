from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.business.serializers import (
    BusinessDetailSerializer,
    BusinessListSerializer,
)
from apps.business.services import BusinessService


class BusinessListView(generics.ListAPIView):
    """UC-02 Browse Businesses (stub). Any authenticated role."""
    serializer_class = BusinessListSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return BusinessService.list_businesses(
            search=self.request.query_params.get("search"),
            ordering=self.request.query_params.get("ordering"),
            category_id=self.request.query_params.get("category_id"),
            cluster_id=self.request.query_params.get("cluster_id"),
        )


class BusinessDetailView(generics.RetrieveAPIView):
    """UC-02 View Business Profile (stub). Any authenticated role."""
    serializer_class = BusinessDetailSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return BusinessService.get_business(self.kwargs["BUSINESS_ID"])


