from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)
    first_name = serializers.CharField(source="USER_FNAME", read_only=True)
    last_name = serializers.CharField(source="USER_LNAME", read_only=True)

    avatar_url = serializers.ReadOnlyField()

    role = serializers.CharField(source="USER_ROLE", read_only=True)
    status = serializers.CharField(source="USER_STATUS", read_only=True)
    has_completed_interest_selection = serializers.BooleanField(
        source="HAS_COMPLETED_INTEREST_SELECTION",
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "avatar_url",
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