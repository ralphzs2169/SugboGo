from rest_framework.views import APIView

from apps.reviews.serializers.my_review_serializers import (
    MyReviewQuerySerializer,
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
        query = MyReviewQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        summary = MyReviewService.summarize_reviews(reviews)
        reviews = MyReviewService.filter_and_sort_reviews(
            queryset=reviews,
            status=query.validated_data["status"],
            ordering=query.validated_data["ordering"],
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            reviews,
            request,
        )
        page = ReviewService._attach_vouched_specialties(page)

        response = paginator.get_paginated_response(
            MyReviewResponseSerializer(
                page,
                many=True,
                context={"request": request},
            ).data,
        )
        response.data["data"]["summary"] = summary
        return response
