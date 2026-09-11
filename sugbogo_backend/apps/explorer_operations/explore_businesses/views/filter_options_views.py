from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.models import Category, Cluster, SpecialtyTag
from apps.explorer_operations.explore_businesses.serializers.filter_options_serializers import (
    FilterOptionCategorySerializer,
    FilterOptionClusterSerializer,
    FilterOptionSpecialtySerializer,
)
from apps.users.models import User
from core.responses import success_response


class ExploreFilterOptionsView(APIView):
    """Returns shared read-only taxonomy options for Explorer filtering."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Returns authoritative cluster, category, and specialty IDs."""

        clusters = Cluster.objects.order_by(
            "CLUS_NAME",
            "CLUS_ID",
        )
        categories = Category.objects.order_by(
            "CTGRY_NAME",
            "CTGRY_ID",
        )
        specialty_tags = SpecialtyTag.objects.order_by(
            "TAG_NAME",
            "TAG_ID",
        )

        return success_response(
            data={
                "clusters": FilterOptionClusterSerializer(
                    clusters,
                    many=True,
                ).data,
                "categories": FilterOptionCategorySerializer(
                    categories,
                    many=True,
                ).data,
                "specialty_tags": FilterOptionSpecialtySerializer(
                    specialty_tags,
                    many=True,
                ).data,
            },
            message="Explore filter options retrieved successfully.",
        )
