from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import HasRole
from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.merchant_application.serializers.application_serializers import (
    ApplicationDetailSerializer,
)
from apps.merchant_application.serializers.review_serializers import (
    MerchantApplicationReviewSerializer,
)
from apps.users.models import User


@api_view(["PATCH"])
@permission_classes([
    IsAuthenticated,
    HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
])
def application_review_view(request, application_id):
    """Approve or reject one submitted merchant application."""
    serializer = MerchantApplicationReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if serializer.validated_data["action"] == "approve":
        AdminApplicationService.approve_application(
            application_id=application_id,
            reviewer=request.user,
        )
    else:
        AdminApplicationService.reject_application(
            application_id=application_id,
            feedback=serializer.validated_data["feedback"],
            reviewer=request.user,
        )

    application = AdminApplicationService.get_application_for_review(
        application_id,
    )

    return success_response(
        data=ApplicationDetailSerializer(application).data,
        message="Application reviewed successfully.",
    )
