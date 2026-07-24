from apps.users.models import User


class ProfileService:
    """
    Handles user profile-related operations, such as updating avatar preferences.
    """

    @staticmethod
    def update_profile(user, validated_data):
        """
        Updates the user's profile information based on the provided validated data.
        """
        for field, value in validated_data.items():
            setattr(user, field, value)

        user.save()

        return user

    
    @staticmethod
    def update_avatar_preferences(user: User, use_oauth_avatar: bool):
        """
        Updates the user's avatar display preferences.
        - If `use_oauth_avatar` is True, the frontend will display the 
           OAuth avatar (if available) instead of a custom profile picture.
        """
        user.USER_USE_OAUTH_AVATAR = use_oauth_avatar

        user.save(
            update_fields=[
                "USER_USE_OAUTH_AVATAR",
            ]
        )

        return user