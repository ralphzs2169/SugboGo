from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.users.serializers.profile import (
    AvatarPreferencesSerializer,
    ProfilePictureSerializer,
    UserSerializer,
    UserInterestsUpdateSerializer,
    UserUpdateSerializer,
)
from apps.users.services.interest_service import UserInterestService
from apps.users.services.profile_picture_service import ProfilePictureService
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


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def complete_interest_selection(request):
    if request.method == "GET":
        return success_response(
            message="Interests retrieved successfully.",
            data=UserInterestService.get_interests(request.user),
        )

    onboarding = request.method == "PATCH"
    serializer = UserInterestsUpdateSerializer(
        data=request.data,
        context={
            "onboarding": onboarding,
        },
    )
    serializer.is_valid(raise_exception=True)

    specialty_tag_ids = serializer.validated_data.get(
        "specialty_tag_ids",
    )
    if onboarding and specialty_tag_ids is None:
        specialty_tag_ids = []

    interests = UserInterestService.update_interests(
        user=request.user,
        category_ids=serializer.validated_data.get("category_ids"),
        specialty_tag_ids=specialty_tag_ids,
        complete_onboarding=onboarding,
    )

    if onboarding:
        message = "Interest selection completed successfully."
    else:
        message = "Interests updated successfully."

    return success_response(
        message=message,
        data=interests,
    )
