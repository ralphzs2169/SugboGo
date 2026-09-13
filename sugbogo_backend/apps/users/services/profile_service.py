class ProfileService:
    """Handles authenticated user profile updates."""

    @staticmethod
    def update_profile(user, validated_data):
        """
        Updates the user's profile information based on the provided validated data.
        """
        for field, value in validated_data.items():
            setattr(user, field, value)

        user.save()

        return user
