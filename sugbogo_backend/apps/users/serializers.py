from rest_framework import serializers
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)
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
            "role",
            "status",
            "has_completed_interest_selection",
        )