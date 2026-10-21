"""Provide privacy-safe merchant warnings and role-protected duplicate review."""

from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_application.serializers.duplicate_serializers import (
    DuplicateReviewCommandSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.duplicate_detection_service import (
    DuplicateDetectionService,
)
from apps.merchant_application.services.duplicate_review_service import (
    DuplicateReviewService,
)
from apps.users.models import User


class MerchantDuplicateWarningView(APIView):
    """Reveal only whether the authenticated merchant's saved draft has possible matches."""

    permission_classes = (IsAuthenticated,)

    def get(
        self,
        request,
    ):
        """Evaluate saved evidence without mutating draft progress or correction state."""
        application = ApplicationService.get_current_application(request.user)
        sufficient = (
            application is not None
            and DuplicateDetectionService.application_snapshot(application) is not None
        )
        possible = False
        if sufficient:
            possible = bool(DuplicateDetectionService.find_candidates(application))
        return success_response(data={
            "evaluated": sufficient,
            "possible_duplicate": possible,
        })


class AdminDuplicateReviewView(APIView):
    """Inspect matches and record submission-specific duplicate decisions."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
        application_id,
    ):
        """Return live candidate evidence and current assessment validity."""
        from apps.admin_operations.business_management.services.manage_application_service import (
            ApplicationService as AdminApplicationService,
        )

        application = AdminApplicationService.get_application_for_review(application_id)
        return success_response(data=DuplicateReviewService.review_state(application))

    def post(
        self,
        request,
        application_id,
    ):
        """Save an assessment or clear the current duplicate rejection for resubmission."""
        serializer = DuplicateReviewCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["action"] == "reconsider":
            state = DuplicateReviewService.reconsider(
                application_id,
                request.user,
                data["review_id"],
                data["explanation"],
            )
        else:
            state = DuplicateReviewService.assess(
                application_id,
                request.user,
                data,
            )
        return success_response(data=state, message="Duplicate review saved.")
