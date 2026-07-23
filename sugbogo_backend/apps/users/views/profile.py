from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.users.services.profile_picture_service import ProfilePictureService

from apps.users.serializers.profile import UserSerializer
from apps.users.serializers.profile import (
    ProfilePictureSerializer,
)

from core.responses import success_response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    print(serializer.data)
    return success_response(
        message="User retrieved successfully.",
        data=serializer.data
    )

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_profile_picture(request):
    serializer = ProfilePictureSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    avatar_url = ProfilePictureService.upload(
        user=request.user,
        image=serializer.validated_data["image"]
    )

    return success_response(
        message="Profile picture updated successfully.",
        data={
            "avatar_url": avatar_url
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def has_completed_interest_selection(request):

    user = request.user

    user.HAS_COMPLETED_INTEREST_SELECTION = True
    user.save(update_fields=["HAS_COMPLETED_INTEREST_SELECTION"])

    return success_response(
        message="Interest selection completed successfully."
    )