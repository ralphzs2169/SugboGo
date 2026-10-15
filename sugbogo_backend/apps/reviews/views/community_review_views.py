from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.community_review_serializers import (
    CommunityReviewQuerySerializer,
    CommunityReviewResponseSerializer,
)
from apps.reviews.services.community_review_service import (
    CommunityReviewService,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User
from core.pagination import StandardPagination


class CommunityReviewListView(APIView):
    """Return the paginated public review feed used by Community."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def get(self, request):
        """Return one filtered and deterministically ordered review page."""

        query = CommunityReviewQuerySerializer(
            data=request.query_params,
        )
        query.is_valid(
            raise_exception=True,
        )

        reviews = CommunityReviewService.list_reviews_queryset(
            user=request.user,
            ordering=query.validated_data["ordering"],
            cluster_id=query.validated_data.get("cluster"),
            category_ids=query.validated_data.get("category"),
            specialty_tag_id=query.validated_data.get("specialty_tag"),
            has_photos=query.validated_data["has_photos"],
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            reviews,
            request,
        )
        page = ReviewService._attach_vouched_specialties(page)

        return paginator.get_paginated_response(
            CommunityReviewResponseSerializer(
                page,
                many=True,
            ).data,
        )
