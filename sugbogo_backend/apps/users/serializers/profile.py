from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)
    first_name = serializers.CharField(source="USER_FNAME", read_only=True)
    last_name = serializers.CharField(source="USER_LNAME", read_only=True)

    avatar_url = serializers.ReadOnlyField()
    use_oauth_avatar = serializers.BooleanField(
        source="USER_USE_OAUTH_AVATAR",
        read_only=True,
    )
    role = serializers.CharField(source="USER_ROLE", read_only=True)
    status = serializers.CharField(source="USER_STATUS", read_only=True)
    has_custom_profile_picture = serializers.SerializerMethodField()
    has_completed_interest_selection = serializers.BooleanField(
        source="HAS_COMPLETED_INTEREST_SELECTION",
        read_only=True,
    )

    def get_has_custom_profile_picture(self, obj):
        return bool(obj.USER_PROFILE_PICTURE)
    
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",

            "avatar_url",
            "has_custom_profile_picture",
            "use_oauth_avatar",
            
            "role",
            "status",
            "has_completed_interest_selection",
        )


class ProfilePictureSerializer(serializers.Serializer):
    """
    Validates a profile picture upload request.
    """

    image = serializers.ImageField()


class UserUpdateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="USER_FNAME")
    last_name = serializers.CharField(source="USER_LNAME")
    
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
        ]

class AvatarPreferencesSerializer(serializers.Serializer):
    use_oauth_avatar = serializers.BooleanField()