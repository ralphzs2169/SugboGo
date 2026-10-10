import math

from rest_framework import serializers

from apps.business.models import BusinessLandmark
from apps.merchant_operations.business_profile.models import (
    BusinessLocationChangeRequest,
    BusinessLocationLandmarkSnapshot,
)
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    BusinessNameChangeUserSerializer,
)
from apps.merchant_operations.business_profile.serializers.merchant_change_reason_serializers import (
    MerchantChangeReasonField,
)


class LocationCoordinateSerializer(serializers.Serializer):
    """Validate finite WGS84 coordinates used by location proposals."""

    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)

    def validate_latitude(

        self,

        value,

    ):
        """Reject non-finite latitude values before creating a GIS point."""
        if not math.isfinite(value):
            raise serializers.ValidationError("Enter a valid latitude.")
        return value

    def validate_longitude(

        self,

        value,

    ):
        """Reject non-finite longitude values before creating a GIS point."""
        if not math.isfinite(value):
            raise serializers.ValidationError("Enter a valid longitude.")
        return value


class BusinessLocationProposalSerializer(LocationCoordinateSerializer):
    """Accept the approved business location's flat address semantics."""

    address = serializers.CharField(max_length=255, trim_whitespace=True)
    city = serializers.CharField(max_length=100, trim_whitespace=True)
    province = serializers.CharField(max_length=100, trim_whitespace=True)
    postal_code = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )


class BusinessLocationLandmarkProposalSerializer(LocationCoordinateSerializer):
    """Validate one Registration-compatible selected landmark."""

    name = serializers.CharField(max_length=150, trim_whitespace=True)
    address = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    source = serializers.ChoiceField(
        choices=BusinessLandmark.LandmarkSource.choices,
    )
    place_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(

        self,

        attrs,

    ):
        """Preserve Registration's Google landmark address requirement."""
        if (
            attrs["source"] == BusinessLandmark.LandmarkSource.GOOGLE
            and not attrs.get("address")
        ):
            raise serializers.ValidationError({
                "address": "Address is required for Google landmarks.",
            })
        return attrs


class BusinessLocationChangeCreateSerializer(serializers.Serializer):
    """Require a complete proposed location and desired landmark set."""

    proposed_location = BusinessLocationProposalSerializer()
    reason = MerchantChangeReasonField(required=False)
    proposed_landmarks = BusinessLocationLandmarkProposalSerializer(
        many=True,
        max_length=5,
        error_messages={
            "max_length": "You can only add up to 5 landmarks.",
        },
    )


class BusinessLocationChangeRejectSerializer(serializers.Serializer):
    """Require a merchant-facing rejection reason."""

    rejection_reason = serializers.CharField(
        min_length=1,
        max_length=1000,
        trim_whitespace=True,
    )


class MerchantBusinessLocationChangeSerializer(serializers.ModelSerializer):
    """Return frozen location and landmark snapshots to the merchant."""

    id = serializers.IntegerField(source="BLCR_ID", read_only=True)
    request_type = serializers.SerializerMethodField()
    status = serializers.CharField(source="BLCR_STATUS", read_only=True)
    previous = serializers.SerializerMethodField()
    proposed = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(
        source="BLCR_SUBMITTED_AT",
        read_only=True,
    )
    resolved_at = serializers.DateTimeField(
        source="BLCR_RESOLVED_AT",
        read_only=True,
    )
    rejection_reason = serializers.CharField(
        source="BLCR_REJECTION_REASON",
        read_only=True,
    )
    reason = serializers.CharField(source="BLCR_MERCHANT_REASON", read_only=True)

    class Meta:
        model = BusinessLocationChangeRequest
        fields = (
            "id",
            "request_type",
            "status",
            "previous",
            "proposed",
            "submitted_at",
            "resolved_at",
            "rejection_reason",
            "reason",
        )

    def get_request_type(

        self,

        obj,

    ):
        """Identify the request in future combined history views."""
        return "location"

    @staticmethod
    def _location(
        obj,
        side,
    ):
        """Read coordinates and flat address fields from a frozen snapshot."""
        prefix = f"BLCR_{side.upper()}_"
        point = getattr(obj, f"{prefix}POINT")
        location = {
            "latitude": point.y,
            "longitude": point.x,
            "address": getattr(obj, f"{prefix}ADDRESS"),
            "city": getattr(obj, f"{prefix}CITY"),
            "province": getattr(obj, f"{prefix}PROVINCE"),
            "postal_code": getattr(obj, f"{prefix}POSTAL_CODE"),
        }
        if side == "previous":
            location["id"] = obj.BLCR_PREVIOUS_LOCT_ID
        return location

    @staticmethod
    def _landmarks(
        obj,
        side,
    ):
        """Read the submitted landmark collection without live lookups."""
        return [
            {
                "id": snapshot.BLLS_PREVIOUS_BLMK_ID,
                "name": snapshot.BLLS_NAME,
                "address": snapshot.BLLS_ADDRESS,
                "latitude": snapshot.BLLS_POINT.y,
                "longitude": snapshot.BLLS_POINT.x,
                "source": snapshot.BLLS_SOURCE,
                "place_id": snapshot.BLLS_PLACE_ID,
            }
            for snapshot in obj.landmark_snapshots.all()
            if snapshot.BLLS_SIDE == side
        ]

    def _snapshot(

        self,

        obj,

        side,

    ):
        """Group one side's flat location and complete landmark set."""
        return {
            "location": self._location(obj, side),
            "landmarks": self._landmarks(obj, side),
        }

    def get_previous(

        self,

        obj,

    ):
        """Return the captured live baseline at submission."""
        return self._snapshot(obj, BusinessLocationLandmarkSnapshot.Side.PREVIOUS)

    def get_proposed(

        self,

        obj,

    ):
        """Return the frozen merchant proposal."""
        return self._snapshot(obj, BusinessLocationLandmarkSnapshot.Side.PROPOSED)


class AdminBusinessLocationChangeSerializer(MerchantBusinessLocationChangeSerializer):
    """Add current live state and reviewer context for decisions."""

    business_id = serializers.IntegerField(source="BUSN_ID_id", read_only=True)
    current_business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.URLField(
        source="BUSN_ID.BUSN_COVER_PHOTO_URL",
        read_only=True,
    )
    current = serializers.SerializerMethodField()
    merchant = BusinessNameChangeUserSerializer(source="USER_ID", read_only=True)
    reviewer = BusinessNameChangeUserSerializer(source="REVIEWER_ID", read_only=True)

    class Meta(MerchantBusinessLocationChangeSerializer.Meta):
        fields = MerchantBusinessLocationChangeSerializer.Meta.fields + (
            "business_id",
            "current_business_name",
            "cover_photo_url",
            "current",
            "merchant",
            "reviewer",
        )

    def get_current(

        self,

        obj,

    ):
        """Show current live values separately from the captured baseline."""
        location = obj.BUSN_ID.LOCT_ID
        return {
            "location": {
                "id": location.LOCT_ID,
                "latitude": location.LOCT_POINT.y,
                "longitude": location.LOCT_POINT.x,
                "address": location.LOCT_ADDRESS,
                "city": location.LOCT_CITY,
                "province": location.LOCT_PROVINCE,
                "postal_code": location.LOCT_POSTAL_CODE,
            },
            "landmarks": [
                {
                    "id": landmark.BLMK_ID,
                    "name": landmark.BLMK_NAME,
                    "address": landmark.BLMK_ADDRESS,
                    "latitude": landmark.BLMK_POINT.y,
                    "longitude": landmark.BLMK_POINT.x,
                    "source": landmark.BLMK_SOURCE,
                    "place_id": landmark.BLMK_PLACE_ID,
                }
                for landmark in location.landmarks.all()
            ],
        }
