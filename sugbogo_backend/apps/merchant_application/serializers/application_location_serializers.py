from rest_framework import serializers

from apps.merchant_application.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)


class ApplicationLandmarkSerializer(serializers.ModelSerializer):
    """Handles one landmark belonging to the business location step."""

    name = serializers.CharField(
        source="MLMK_NAME",
        error_messages={
            "blank": "Landmark name is required.",
            "required": "Landmark name is required.",
        },
    )
    address = serializers.CharField(
        source="MLMK_ADDRESS",
        required=False,
        allow_blank=True,
        error_messages={
            "blank": "Landmark address is required.",
            "required": "Landmark address is required.",
        },
    )
    
    latitude = serializers.FloatField(
        write_only=True,
        min_value=-90,
        max_value=90,
    )

    longitude = serializers.FloatField(
        write_only=True,
        min_value=-180,
        max_value=180,
    )
    source = serializers.ChoiceField(
        source="MLMK_SOURCE",
        choices=MerchantApplicationLandmark.LandmarkSource.choices,
    )
    place_id = serializers.CharField(
        source="MLMK_PLACE_ID",
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        source = attrs.get("MLMK_SOURCE")
        address = attrs.get("MLMK_ADDRESS")

        if source == MerchantApplicationLandmark.LandmarkSource.GOOGLE:
            if not address:
                raise serializers.ValidationError({
                    "address": "Address is required for Google landmarks."
                })

        return attrs
    
    class Meta:
        model = MerchantApplicationLandmark
        fields = (
            "name",
            "address",
            "latitude",
            "longitude",
            "source",
            "place_id",
        )


class ApplicationLocationSerializer(serializers.ModelSerializer):
    """Handles the complete Step 2 business location, including landmarks."""

    province = serializers.CharField(
        source="MLOC_PROVINCE",
        error_messages={
            "blank": "Province is required.",
            "required": "Province is required.",
        },
    )
    city = serializers.CharField(
        source="MLOC_CITY",
        error_messages={
            "blank": "City is required.",
            "required": "City is required.",
        },
    )
    barangay = serializers.CharField(
        source="MLOC_BARANGAY",
        error_messages={
            "blank": "Barangay is required.",
            "required": "Barangay is required.",
        },
    )
    street_address = serializers.CharField(
        source="MLOC_STREET_ADDRESS",
        error_messages={
            "blank": "Street address is required.",
            "required": "Street address is required.",
        },
    )
    unit = serializers.CharField(
        source="MLOC_UNIT",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    latitude = serializers.FloatField(
        write_only=True,
        min_value=-90,
        max_value=90,
    )

    longitude = serializers.FloatField(
        write_only=True,
        min_value=-180,
        max_value=180,
    )

    landmarks = ApplicationLandmarkSerializer(
        many=True,
        required=False,
        max_length=5,
        error_messages={
            "max_length": "You can only add up to 5 landmarks.",
        },
    )

    class Meta:
        model = MerchantApplicationLocation
        fields = (
            "province",
            "city",
            "barangay",
            "street_address",
            "unit",
            "latitude",
            "longitude",
            "landmarks",
        )


class ApplicationLandmarkReadSerializer(serializers.ModelSerializer):
    """Read serializer for one landmark belonging to the business location."""

    id = serializers.IntegerField(source="MLMK_ID", read_only=True)
    name = serializers.CharField(source="MLMK_NAME", read_only=True)
    address = serializers.CharField(source="MLMK_ADDRESS", read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    source = serializers.CharField(source="MLMK_SOURCE", read_only=True)
    place_id = serializers.CharField(source="MLMK_PLACE_ID", read_only=True)

    class Meta:
        model = MerchantApplicationLandmark
        fields = (
            "id",
            "name",
            "address",
            "latitude",
            "longitude",
            "source",
            "place_id",
        )

    def get_latitude(self, obj):
        return obj.MLMK_POINT.y if obj.MLMK_POINT else None

    def get_longitude(self, obj):
        return obj.MLMK_POINT.x if obj.MLMK_POINT else None


class ApplicationLocationReadSerializer(serializers.ModelSerializer):
    """Read serializer for the complete Step 2 location and landmarks."""

    province = serializers.CharField(source="MLOC_PROVINCE", read_only=True)
    city = serializers.CharField(source="MLOC_CITY", read_only=True)
    barangay = serializers.CharField(source="MLOC_BARANGAY", read_only=True)
    street_address = serializers.CharField(
        source="MLOC_STREET_ADDRESS",
        read_only=True,
    )
    unit = serializers.CharField(source="MLOC_UNIT", read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    landmarks = ApplicationLandmarkReadSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = MerchantApplicationLocation
        fields = (
            "province",
            "city",
            "barangay",
            "street_address",
            "unit",
            "latitude",
            "longitude",
            "landmarks",
        )

    def get_latitude(self, obj):
        return obj.MLOC_POINT.y if obj.MLOC_POINT else None

    def get_longitude(self, obj):
        return obj.MLOC_POINT.x if obj.MLOC_POINT else None