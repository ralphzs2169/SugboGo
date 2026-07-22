from rest_framework.decorators import api_view
from rest_framework import status

from apps.authentication.serializers import RegisterSerializer
from apps.users.models import User
from core.responses import success_response
from apps.authentication.services.email_service import EmailService


@api_view(["POST"])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data

    user = User.objects.create_user(
        email=data["email"],
        password=data["password"],
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