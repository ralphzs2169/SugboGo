"""Administrator-only SQL reporting endpoints using existing period and response contracts."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from .serializers.change_request_serializers import ChangeRequestAnalyticsSerializer
from .serializers.community_health_serializers import CommunityHealthSerializer
from .serializers.platform_analytics_serializers import AnalyticsPeriodQuerySerializer
from .serializers.platform_growth_serializers import PlatformGrowthSerializer
from .serializers.reporting_serializers import ReportingSeriesQuerySerializer
from .serializers.specialty_support_serializers import SpecialtySupportSerializer
from .services.change_request_analytics_service import ChangeRequestAnalyticsService
from .services.community_health_service import CommunityHealthService
from .services.platform_growth_service import PlatformGrowthService
from .services.specialty_support_service import SpecialtySupportService


class AdminReportingView(APIView):
    """Apply the established administrator permission, validation and output envelope."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )
    query_serializer = AnalyticsPeriodQuerySerializer

    def get(
        self,
        request,
    ):
        """Validate reporting inputs before executing one focused aggregate service."""
        query = self.query_serializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        options = {}
        if "interval" in values:
            options["interval"] = values["interval"]
        report = self.service.get_report(
            values["report_period"],
            **options,
        )
        return success_response(
            data=self.response_serializer(report).data,
            message=self.message,
        )


class PlatformGrowthView(AdminReportingView):
    """Expose current inventory and retained acquisition events independently of discovery."""

    query_serializer = ReportingSeriesQuerySerializer
    service = PlatformGrowthService
    response_serializer = PlatformGrowthSerializer
    message = "Platform growth analytics retrieved successfully."


class CommunityHealthView(AdminReportingView):
    """Expose retained publication cohorts and stored classified sentiment."""

    query_serializer = ReportingSeriesQuerySerializer
    service = CommunityHealthService
    response_serializer = CommunityHealthSerializer
    message = "Community health analytics retrieved successfully."


class SpecialtySupportView(AdminReportingView):
    """Expose explicitly current multi-label specialty evidence."""

    service = SpecialtySupportService
    response_serializer = SpecialtySupportSerializer
    message = "Specialty support analytics retrieved successfully."


class ChangeRequestAnalyticsView(AdminReportingView):
    """Expose current listing-change queues and selected-period resolution outcomes."""

    service = ChangeRequestAnalyticsService
    response_serializer = ChangeRequestAnalyticsSerializer
    message = "Change-request analytics retrieved successfully."
