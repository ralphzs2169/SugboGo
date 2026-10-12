"""Administrator-only onboarding and moderation operations analytics endpoints."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.analytics.serializers.operations_analytics_serializers import (
    AttentionQueueSerializer, OnboardingAnalyticsSerializer,
)
from apps.admin_operations.analytics.serializers.platform_analytics_serializers import AnalyticsPeriodQuerySerializer
from apps.admin_operations.analytics.services.attention_queue_service import AttentionQueueService
from apps.admin_operations.analytics.services.onboarding_analytics_service import OnboardingAnalyticsService
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response


class OnboardingAnalyticsView(APIView):
    """Expose unchanged onboarding statistics and additive operational aggregates."""

    permission_classes = (
        IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Validate the Manila period and retain labeled native legacy metrics."""
        query = AnalyticsPeriodQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = OnboardingAnalyticsService.get_report(query.validated_data["report_period"])
        return success_response(
            data=OnboardingAnalyticsSerializer(report).data,
            message="Onboarding analytics retrieved successfully.",
        )


class AttentionQueueView(APIView):
    """Expose current pending queues and completed-dispute turnaround aggregates."""

    permission_classes = (
        IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Validate the resolution period without filtering the current pending backlog."""
        query = AnalyticsPeriodQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        report = AttentionQueueService.get_report(query.validated_data["report_period"])
        return success_response(
            data=AttentionQueueSerializer(report).data,
            message="Attention queue analytics retrieved successfully.",
        )
