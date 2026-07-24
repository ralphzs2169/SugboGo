from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.users.services.profile_picture_service import ProfilePictureService

from apps.users.serializers.profile import (
    AvatarPreferencesSerializer, UserSerializer, ProfilePictureSerializer, UserUpdateSerializer
)
from core.responses import success_response
from apps.users.services.profile_service import ProfileService




@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):

    if request.method == "GET":
        serializer = UserSerializer(request.user)
        print(serializer.data)
        return success_response(
            message="User retrieved successfully.",
            data=serializer.data
        )

    # PATCH request to update user profile
    serializer = UserUpdateSerializer(
        request.user,
        data=request.data,
        partial=True,
    )

    serializer.is_valid(raise_exception=True)

    ProfileService.update_profile(
        user=request.user,
        validated_data=serializer.validated_data,
    )

    return success_response(
        message="Profile updated successfully.",
        data=UserSerializer(request.user).data,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def profile_picture(request):
    """
    PATCH
        Upload or replace the user's profile picture.

    DELETE
        Remove the user's custom profile picture.
    """

    if request.method == "PATCH":
        serializer = ProfilePictureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ProfilePictureService.upload(
            user=request.user,
            image=serializer.validated_data["image"],
        )

        return success_response(
            message="Profile picture updated successfully.",
            data=UserSerializer(request.user).data,
        )

    # DELETE request to remove the user's profile picture
    ProfilePictureService.delete(user=request.user)

    return success_response(
        message="Profile picture removed successfully.",
        data=UserSerializer(request.user).data,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_avatar_preferences(request):
    serializer = AvatarPreferencesSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    ProfileService.update_avatar_preferences(
        user=request.user,
        use_oauth_avatar=serializer.validated_data["use_oauth_avatar"],
    )

    return success_response(
        message="Avatar preferences updated successfully.",
        data=UserSerializer(request.user).data,
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