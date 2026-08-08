from core.responses import success_response
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import HasRole
from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.serializers.application_serializers import (
    ApplicationDetailSerializer,
)
from apps.merchant_application.serializers.review_serializers import (
    MerchantApplicationReviewSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.users.models import User


@api_view(["PATCH"])
@permission_classes([
    IsAuthenticated,
    HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
])
def application_review_view(request, application_id):
    """Approve or reject one submitted merchant application."""
    application = get_object_or_404(MerchantApplication, pk=application_id)

    serializer = MerchantApplicationReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    application = ApplicationService.review_application(
        application=application,
        **serializer.validated_data,
    )

    return success_response(
        data=ApplicationDetailSerializer(application).data,
        message="Application reviewed successfully.",
    )
