from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.serializers import ForgotPasswordSerializer
from apps.users.models import User
from apps.core.responses import success_response
from apps.authentication.services.email_service import EmailService
from apps.authentication.throttles import ForgotPasswordThrottle


@api_view(["POST"])
@throttle_classes([ForgotPasswordThrottle])
def forgot_password_view(request):
    """Handle forgot password requests."""
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(USER_EMAIL__iexact=email)

    except User.DoesNotExist:
        user = None


    if user is not None:
        try:
            EmailService.send_password_reset_email(user)
        except Exception:
            pass

    # Always return the same response to avoid revealing
    # whether an email address is registered.
    return success_response(
        message=(
            "If an account exists with this email, "
            "a password reset link has been sent."
        )
    )


