from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle

from apps.authentication.email_change_serializers import (
    ConfirmEmailChangeSerializer,
    RequestEmailChangeSerializer,
)
from apps.authentication.services.email_change_service import EmailChangeService
from apps.authentication.throttles import (
    EmailChangeConfirmThrottle,
    EmailChangeRequestThrottle,
)
from core.responses import success_response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([EmailChangeRequestThrottle])
def request_email_change_view(request):
    """Requests new-inbox verification after signed-in password proof."""
    serializer = RequestEmailChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    pending = EmailChangeService.request_change(
        user=request.user,
        **serializer.validated_data,
    )
    return success_response(
        data=pending,
        message="Verification sent. Your current email is unchanged.",
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def email_change_status_view(request):
    """Returns safe pending state for the current account."""
    return success_response(data=EmailChangeService.status(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_email_change_view(request):
    """Cancels only the current account's pending email change."""
    EmailChangeService.cancel(request.user)
    return success_response(message="Pending email change cancelled.")


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle, EmailChangeConfirmThrottle])
def confirm_email_change_view(request):
    """Confirms a new address using emailed proof and a fresh password entry."""
    serializer = ConfirmEmailChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = EmailChangeService.confirm(**serializer.validated_data)
    return success_response(
        data=result,
        message="Email changed. Sign in again with your new email.",
    )
