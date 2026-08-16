
from rest_framework import serializers

from apps.admin_operations.taxonomy_management.serializers.specialty_tag_serializers import (
    SpecialtyTagSerializer,
)
from apps.business.models import Business
from apps.business.serializers.business_serializers import BusinessOwnerSerializer


class AdminBusinessListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the administrator business table."""

    id = serializers.IntegerField(
        source="BUSN_ID",
        read_only=True,
    )

    business_name = serializers.CharField(
        source="BUSN_NAME",
        read_only=True,
    )

    owner = BusinessOwnerSerializer(
        source="USER_ID",
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

    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )

    specialty_tags = SpecialtyTagSerializer(
        source="SPECIALTY_TAGS",
        many=True,
        read_only=True,
    )

    location = serializers.CharField(
        source="LOC_ID.LOCT_ADDRESS",
        read_only=True,
    )

    status = serializers.CharField(
        source="BUSN_STATUS",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="BUSN_CREATED_AT",
        read_only=True,
    )


    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "owner",
            "cluster_name",
            "cluster_icon",
            "category_name",
            "specialty_tags",
            "location",
            "status",
            "created_at",
        )