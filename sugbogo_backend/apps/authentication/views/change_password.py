from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.serializers import ChangePasswordSerializer
from apps.authentication.services.change_password_service import ChangePasswordService


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """Changes the current user's password and requires a fresh sign-in."""
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    ChangePasswordService.change_password(
        user=request.user,
        current_password=serializer.validated_data["current_password"],
        new_password=serializer.validated_data["new_password"],
    )
    return success_response(
        message="Password changed successfully. Please sign in again."
    )
