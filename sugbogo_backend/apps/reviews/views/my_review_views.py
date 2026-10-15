from rest_framework.views import APIView

from apps.reviews.serializers.my_review_serializers import (
    MyReviewResponseSerializer,
)
from apps.reviews.services.my_review_service import MyReviewService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.views.review_views import ReviewView
from core.pagination import StandardPagination


class MyReviewListView(APIView):
    """Returns the authenticated author's paginated review history."""

    permission_classes = ReviewView.permission_classes

    def get(
        self,
        request,
    ):
        """Return one page of the requesting author's retained submissions."""
        reviews = MyReviewService.list_reviews_queryset(
            user=request.user,
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            reviews,
            request,
        )
        page = ReviewService._attach_vouched_specialties(page)

        return paginator.get_paginated_response(
            MyReviewResponseSerializer(
                page,
                many=True,
            ).data,
        )
