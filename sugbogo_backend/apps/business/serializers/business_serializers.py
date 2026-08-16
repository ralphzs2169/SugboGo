from rest_framework import serializers

from apps.business.models import SpecialtyTag
from apps.users.models import User


class BusinessOwnerSerializer(serializers.ModelSerializer):
    """Serializer for the SugboGo account linked to a business."""

    name = serializers.CharField(
        source="full_name",
        read_only=True,
    )

    email = serializers.EmailField(
        source="USER_EMAIL",
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "name",
            "email",
        )


class BusinessSpecialtyTagSerializer(serializers.ModelSerializer):
    """Serializer for a business specialty tag."""

    id = serializers.IntegerField(
        source="TAG_ID",
        read_only=True,
    )

    name = serializers.CharField(
        source="TAG_NAME",
        read_only=True,
    )

    color = serializers.CharField(
        source="TAG_COLOR",
        read_only=True,
    )

    class Meta:
        model = SpecialtyTag
        fields = (
            "id",
            "name",
            "color",
        )