from core.responses import success_response
from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.constants import Platform
from apps.authentication.serializers import ForgotPasswordSerializer
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.password_reset_service import PasswordResetService
from apps.authentication.throttles import ForgotPasswordThrottle
from apps.users.models import User


@api_view(["POST"])
@throttle_classes([ForgotPasswordThrottle])
def admin_forgot_password_view(request):
    """
    Handle admin forgot password requests.
    """

    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(USER_EMAIL__iexact=email)

    except User.DoesNotExist:
        user = None

    if (
        user is not None
        and PasswordResetService.is_eligible(user, Platform.WEB)
    ):
        try:
            EmailService.send_password_reset_email(
                user,
                platform=Platform.WEB,
            )
        except Exception:
            pass

    return success_response(
        message=(
            "If an admin account exists with this email, "
            "a password reset link has been sent."
        )
    )
