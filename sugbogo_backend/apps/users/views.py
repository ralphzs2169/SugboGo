from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.users.serializers import UserSerializer
from core.responses import success_response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    return success_response(
        message="User retrieved successfully.",
        data=serializer.data
    )


@api_view(["GET"])
def profile(request):
    return success_response(
        message="Profile retrieved successfully.",
        data={"message": "Profile endpoint"}
    )

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def complete_interest_selection(request):

    user = request.user

    user.HAS_COMPLETED_INTEREST_SELECTION = True
    user.save(update_fields=["HAS_COMPLETED_INTEREST_SELECTION"])

    return success_response(
        message="Interest selection completed successfully."
    )
