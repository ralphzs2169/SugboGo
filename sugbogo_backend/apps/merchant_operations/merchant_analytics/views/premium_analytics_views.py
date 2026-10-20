"""Merchant-only Premium analytics routes protected by the shared entitlement gate."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..permissions import HasMerchantPlus
from ..serializers.standard_analytics_serializers import StandardAnalyticsQuerySerializer
from ..serializers.premium_analytics_serializers import (
    PremiumReviewInsightsSerializer, PremiumReviewPerformanceSerializer, PremiumSpecialtySerializer,
    PremiumVisibilityQuerySerializer, PremiumVisibilitySerializer, PremiumSnapshotQuerySerializer,
)
from ..services.premium_review_insights_service import PremiumReviewInsightsService
from ..services.premium_review_performance_service import PremiumReviewPerformanceService
from ..services.premium_specialty_service import PremiumSpecialtyService
from ..services.premium_visibility_service import PremiumVisibilityService


class PremiumAnalyticsView(APIView):
    """Enforce authentication, merchant eligibility, and Plus before invoking owned-business reads."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT), HasMerchantPlus)
    query_serializer = StandardAnalyticsQuerySerializer

    def get(self, request):
        """Validate accepted parameters and serialize the sanitized aggregate report."""
        query = self.query_serializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = self.get_report(request.user, query.validated_data)
        return success_response(data=self.response_serializer(report).data,
                                message="Merchant Premium analytics retrieved successfully.")


class PremiumVisibilityView(PremiumAnalyticsView):
    """Serve recorded visibility trends independently of Standard responses."""

    query_serializer = PremiumVisibilityQuerySerializer
    response_serializer = PremiumVisibilitySerializer

    def get_report(self, user, query):
        """Resolve ownership inside the service and apply the approved reporting interval."""
        return PremiumVisibilityService.get_report(user, query["report_period"], interval=query["interval"])


class PremiumPocketView(PremiumAnalyticsView):
    """Serve weekly recorded saves and distinct savers, separate from Pocket holders."""

    response_serializer = PremiumVisibilitySerializer
    query_serializer = PremiumSnapshotQuerySerializer

    def get_report(self, user, query):
        """Use fixed weekly SAVE buckets for the authenticated merchant's business."""
        return PremiumVisibilityService.get_report(user, query["report_period"], interval="weekly", pocket=True)


class PremiumSpecialtyView(PremiumAnalyticsView):
    """Serve weekly surviving valid endorsement cohorts for current active specialties."""

    response_serializer = PremiumSpecialtySerializer
    query_serializer = PremiumSnapshotQuerySerializer

    def get_report(self, user, query):
        """Read retained endorsement timestamps without reconstructing deleted support."""
        return PremiumSpecialtyService.get_report(user, query["report_period"])


class PremiumReviewInsightsView(PremiumAnalyticsView):
    """Serve stored summaries with their existing content and sampling gates."""

    response_serializer = PremiumReviewInsightsSerializer

    def get_report(self, user, query):
        """Read sanitized stored results without triggering Gemini or summary refresh."""
        return PremiumReviewInsightsService.get_report(user, query["report_period"])


class PremiumReviewPerformanceView(PremiumAnalyticsView):
    """Serve weekly pooled review sentiment and retained reply performance."""

    response_serializer = PremiumReviewPerformanceSerializer
    query_serializer = PremiumSnapshotQuerySerializer

    def get_report(self, user, query):
        """Use published creation cohorts and the single server-side reply cutoff."""
        return PremiumReviewPerformanceService.get_report(user, query["report_period"])
