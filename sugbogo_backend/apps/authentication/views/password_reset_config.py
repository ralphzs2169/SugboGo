from rest_framework.decorators import api_view
from apps.authentication.services.password_reset_service import PasswordResetService
from core.responses import success_response


@api_view(["GET"])
def password_reset_config_view(request):
    return success_response(
        message="Password reset configuration retrieved.",
        data={
            "expiry_hours": PasswordResetService.get_reset_expiry_hours() // 3600,
        },
    )