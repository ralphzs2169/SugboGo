from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)
from apps.explorer_operations.explore_businesses.serializers.visibility_event_serializer import (
    ImpressionBatchSerializer,
)
from apps.users.models import User
from core.responses import success_response


class BusinessImpressionBatchView(APIView):
    """Record business cards actually shown to the authenticated user."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request):
        serializer = ImpressionBatchSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        result = VisibilityEventService.record_impressions(
            explorer_id=request.user.USER_ID,
            business_ids=serializer.validated_data["business_ids"],
        )

        return success_response(
            data={
                "business_ids": list(
                    result.eligible_business_ids,
                ),
                "recorded_count": result.recorded_count,
                "duplicate_count": result.duplicate_count,
            },
            message="Business impressions recorded successfully.",
        )


class BusinessProfileVisitView(APIView):
    """Record an explicitly reported business-profile visit."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, business_id):
        result = VisibilityEventService.record_profile_visit(
            explorer_id=request.user.USER_ID,
            business_id=business_id,
        )

        return success_response(
            data={
                "business_id": business_id,
                "recorded": result.recorded_count == 1,
                "duplicate": result.duplicate_count == 1,
            },
            message="Business profile visit recorded successfully.",
        )
