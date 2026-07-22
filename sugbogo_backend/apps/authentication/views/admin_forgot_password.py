from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.serializers import ForgotPasswordSerializer
from apps.authentication.throttles import ForgotPasswordThrottle
from apps.authentication.constants import Platform
from apps.authentication.services.email_service import EmailService
from core.responses import success_response
from apps.users.models import User
from apps.authentication.permissions import user_has_role


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

        if not user_has_role(user, User.UserRole.ADMIN):
            user = None

    except User.DoesNotExist:
        user = None

    if user is not None:
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