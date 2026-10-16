"""Separate Premium read and explicit refresh endpoints for stored AI assistance."""

from rest_framework.exceptions import ValidationError
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from core.responses import success_response

from ..serializers.recommendation_serializers import (
    RecommendationQuerySerializer, RecommendationRefreshSerializer, RecommendationResponseSerializer,
)
from ..services.recommendation_service import RecommendationService
from .premium_analytics_views import PremiumAnalyticsView


class RecommendationRefreshThrottle(UserRateThrottle):
    """Bound explicit provider work requests using the existing DRF throttle mechanism."""

    scope = "merchant_recommendation_refresh"
    rate = "3/hour"


class RecommendationView(PremiumAnalyticsView):
    """Serve stored results and deterministic fallback with no generation side effects."""

    query_serializer = RecommendationQuerySerializer
    response_serializer = RecommendationResponseSerializer

    def get_report(self, user, query):
        """Resolve ownership and validate stored evidence for the selected calendar dates."""
        return RecommendationService.read(user, query["report_period"])


class RecommendationRefreshView(APIView):
    """Accept date selection only and acknowledge an explicitly requested background refresh."""

    permission_classes = PremiumAnalyticsView.permission_classes
    throttle_classes = (UserRateThrottle, RecommendationRefreshThrottle)

    def post(self, request):
        """Validate the request body and return an owner-scoped persisted job acknowledgement."""
        if request.query_params:
            raise ValidationError({"query": "Provide date selection in the JSON body only."})
        query = RecommendationQuerySerializer(data=request.data)
        query.is_valid(raise_exception=True)
        job, created = RecommendationService.refresh(request.user, query.validated_data["report_period"])
        job.refresh_from_db()
        payload = RecommendationRefreshSerializer({
            "request_id": job.pk, "state": job.MREC_STATE, "created": created, "source_period": job.MREC_PERIOD,
        }).data
        return success_response(
            data=payload, message="Merchant recommendation refresh request recorded.",
            status_code=202 if job.MREC_STATE in ("pending", "running") else 200,
        )
