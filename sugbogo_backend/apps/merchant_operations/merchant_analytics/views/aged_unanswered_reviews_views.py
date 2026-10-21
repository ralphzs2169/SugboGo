"""Independently refreshable Standard backlog endpoint for the authenticated merchant."""

from rest_framework.views import APIView

from core.responses import success_response

from ..serializers.aged_unanswered_reviews_serializers import (
    AgedUnansweredReviewsQuerySerializer,
    AgedUnansweredReviewsSerializer,
)
from ..services.aged_unanswered_reviews_service import AgedUnansweredReviewsService
from .standard_analytics_views import StandardAnalyticsView


class AgedUnansweredReviewsView(APIView):
    """Use Standard authentication and ownership rules without requiring Merchant Plus."""

    permission_classes = StandardAnalyticsView.permission_classes

    def get(
        self,
        request,
    ):
        """Validate a snapshot-only request and return its sanitized aggregate response."""
        query = AgedUnansweredReviewsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = AgedUnansweredReviewsService.get_report(request.user)
        return success_response(
            data=AgedUnansweredReviewsSerializer(report).data,
            message="Current unanswered review ages retrieved successfully.",
        )
