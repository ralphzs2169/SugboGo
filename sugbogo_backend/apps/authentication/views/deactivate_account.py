from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.serializers import DeactivateAccountSerializer
from apps.authentication.services.account_deactivation_service import (
    AccountDeactivationService,
)
from core.responses import success_response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def deactivate_account_view(request):
    """Deactivates only the authenticated consumer account after password proof."""
    serializer = DeactivateAccountSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    AccountDeactivationService.deactivate(
        user=request.user,
        current_password=serializer.validated_data["current_password"],
    )
    return success_response(
        message="Account deactivated. Contact support to request reactivation.",
    )
