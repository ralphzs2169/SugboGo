from rest_framework.decorators import api_view
from rest_framework import status
from django.utils import timezone

from apps.authentication.serializers import ResendVerificationSerializer
from apps.users.models import User
from core.responses import error_response, success_response
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.verification_service import EmailVerificationService
from apps.authentication.throttles import ResendVerificationThrottle
from rest_framework.exceptions import Throttled


@api_view(["GET"])
def verify_email_view(request):
    uid = request.query_params.get("uid")
    token = request.query_params.get("token")

    if not uid or not token:
        return error_response(
            message="Missing verification credentials.",
            code="MISSING_CREDENTIALS",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    user = EmailVerificationService.verify_token(uid, token)

    if user is None:
       return error_response(
            message=(
                "This verification link is invalid or has expired. "
                "Please request a new verification email."
            ),
            code="INVALID_VERIFICATION_LINK",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if user.EMAIL_VERIFIED:
        return success_response(message="Email is already verified.")

    user.EMAIL_VERIFIED = True
    user.EMAIL_VERIFIED_AT = timezone.now()
    user.save(
        update_fields=[
            "EMAIL_VERIFIED",
            "EMAIL_VERIFIED_AT",
        ]
    )

    return success_response(message="Email verified successfully.")

@api_view(["POST"])
def resend_verification_view(request):
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(USER_EMAIL=email)

    except User.DoesNotExist:
        return error_response(
            message="No account found with this email.",
            code="USER_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if user.EMAIL_VERIFIED:
         return error_response(
            message="Email is already verified.",
            code="EMAIL_ALREADY_VERIFIED",
            status_code=status.HTTP_409_CONFLICT,
        )

    throttle = ResendVerificationThrottle()

    if not throttle.allow_request(request, view=None):
        raise Throttled(wait=throttle.wait())
    

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

    return success_response(message="Verification email sent successfully.")