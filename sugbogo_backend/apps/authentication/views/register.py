from core.responses import success_response
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes

from apps.authentication.serializers import RegisterSerializer
from apps.authentication.services.email_service import EmailService
from apps.authentication.throttles import RegisterThrottle
from apps.users.models import User


@api_view(["POST"])
@throttle_classes([RegisterThrottle])
def register_view(request):
    """Create an unverified Explorer without accepting a sign-in password yet."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data

    user = User.objects.create_user(
        email=data["email"],
        USER_FNAME=data["first_name"],
        USER_LNAME=data["last_name"],
        USER_ROLE=User.UserRole.EXPLORER,
        USER_STATUS=User.UserStatus.ACTIVE,
    )

    try:
        EmailService.send_verification_email(user)
    except Exception:
        pass

    return success_response(
        message="Registration successful. Please verify your email.",
        status_code=status.HTTP_201_CREATED,
    )
