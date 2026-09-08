from rest_framework import serializers

from apps.business.models.business_core_models import Business
from apps.business.models.business_vouch_models import BusinessSpecialtyTag
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

    avatar_url = serializers.CharField(
        source="USER_PROFILE_PICTURE",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "name",
            "email",
            "avatar_url",
        )


class BusinessSpecialtyTagSerializer(serializers.ModelSerializer):
    """Serializes a specialty tag associated with a business."""

    id = serializers.IntegerField(
        source="TAG_ID.TAG_ID",
        read_only=True,
    )

    name = serializers.CharField(
        source="TAG_ID.TAG_NAME",
        read_only=True,
    )

    color = serializers.CharField(
        source="TAG_ID.TAG_COLOR",
        read_only=True,
    )

    vouch_count = serializers.IntegerField(
        source="BST_VOUCH_COUNT",
        read_only=True,
    )

    class Meta:
        model = BusinessSpecialtyTag
        fields = (
            "id",
            "name",
            "color",
            "vouch_count",
        )


class BusinessContextSerializer(serializers.ModelSerializer):
    """Serialize core business information for contextual display."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
        allow_null=True,
    )
    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )
    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )
    cluster_icon = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_ICON",
        read_only=True,
    )
    specialty_tags = BusinessSpecialtyTagSerializer(
        source="active_specialty_tag_links",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Business
        fields = (
            "id",
            "name",
            "cover_photo_url",
            "category_name",
            "cluster_name",
            "cluster_icon",
            "specialty_tags",
        )
