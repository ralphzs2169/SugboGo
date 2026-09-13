from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.users.serializers.profile_serializers import (
    AvatarPreferencesSerializer,
    ProfilePictureSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.users.services.profile_picture_service import ProfilePictureService
from apps.users.services.profile_service import ProfileService


class UserProfileView(APIView):
    """Retrieves and updates the authenticated user's profile."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Retrieves the authenticated user's profile."""
        serializer = UserSerializer(
            request.user,
        )

        return success_response(
            message="User retrieved successfully.",
            data=serializer.data,
        )

    def patch(self, request):
        """Updates the authenticated user's profile."""
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        ProfileService.update_profile(
            user=request.user,
            validated_data=serializer.validated_data,
        )

        return success_response(
            message="Profile updated successfully.",
            data=UserSerializer(request.user).data,
        )


class ProfilePictureView(APIView):
    """Manages the authenticated user's profile picture."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request):
        """Uploads or replaces the user's profile picture."""
        serializer = ProfilePictureSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        ProfilePictureService.upload(
            user=request.user,
            image=serializer.validated_data["image"],
        )

        return success_response(
            message="Profile picture updated successfully.",
            data=UserSerializer(request.user).data,
        )

    def delete(self, request):
        """Removes the user's custom profile picture."""
        ProfilePictureService.delete(
            user=request.user,
        )

        return success_response(
            message="Profile picture removed successfully.",
            data=UserSerializer(request.user).data,
        )


class AvatarPreferencesView(APIView):
    """Updates the authenticated user's avatar preferences."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request):
        """Updates whether the user prefers their OAuth avatar."""
        serializer = AvatarPreferencesSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        ProfileService.update_avatar_preferences(
            user=request.user,
            use_oauth_avatar=serializer.validated_data[
                "use_oauth_avatar"
            ],
        )

        return success_response(
            message="Avatar preferences updated successfully.",
            data=UserSerializer(request.user).data,
        )