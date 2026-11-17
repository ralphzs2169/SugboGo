from django.db import transaction
from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from apps.authentication.models import LoginEvent
from apps.authentication.serializers import (
    LoginResponseSerializer,
    ResendVerificationSerializer,
    VerifyEmailSerializer,
)
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.verification_service import EmailVerificationService
from apps.authentication.throttles import ResendVerificationThrottle
from apps.authentication.utils.jwt import issue_tokens
from apps.users.models import User


@api_view(["POST"])
@transaction.atomic
def verify_email_view(request):
    """Verify the address and optionally start a session for a newly verified Explorer."""
    serializer = VerifyEmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    result = EmailVerificationService.verify_email(
        uid=serializer.validated_data["uid"],
        token=serializer.validated_data["token"],
        password=serializer.validated_data["password"],
    )

    if isinstance(result, Response):
        return result

    if (
        serializer.validated_data["auto_login"]
        and result.USER_ROLE == User.UserRole.EXPLORER
        and not request.user.is_authenticated
    ):
        tokens = issue_tokens(
            result,
            remember_me=False,
            request=request,
            method=LoginEvent.Method.PASSWORD,
        )
        data = LoginResponseSerializer({"user": result, **tokens}).data
        response = success_response(
            message="Email verified successfully.",
            data=data,
        )
        response["Cache-Control"] = "no-store"
        return response

    return success_response(message="Email verified successfully.")

@api_view(["POST"])
@throttle_classes([ResendVerificationThrottle])
def resend_verification_view(request):
    """Resend ordinary verification for eligible, unverified accounts."""
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(USER_EMAIL__iexact=email)
    except User.DoesNotExist:
        user = None

    if (
        user is None
        or not EmailVerificationService.is_eligible(user)
    ):
        return error_response(
            message="No account found with this email.",
            code="USER_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if user.EMAIL_VERIFIED and user.is_active:
        return error_response(
            message="Email is already verified.",
            code="EMAIL_ALREADY_VERIFIED",
            status_code=status.HTTP_409_CONFLICT,
        )

    try:
        EmailService.send_verification_email(user)
    except Exception:
        return error_response(
            message=(
                "Unable to send verification email. "
                "Please try again later."
            ),
            code="EMAIL_SEND_FAILED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return success_response(
        message="Verification email sent successfully.",
    )
