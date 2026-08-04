from rest_framework import serializers

from apps.registration.models import MerchantApplicationOperatingHours


class OperatingHoursDaySerializer(serializers.Serializer):
    """One day's hours — used as a nested item inside the weekly payload."""

    day = serializers.ChoiceField(
        choices=MerchantApplicationOperatingHours.Day.choices
    )
    is_open = serializers.BooleanField()
    is_24_hours = serializers.BooleanField(default=False)
    open_time = serializers.TimeField(required=False, allow_null=True)
    close_time = serializers.TimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("is_open") and not attrs.get("is_24_hours"):
            if not attrs.get("open_time") or not attrs.get("close_time"):
                raise serializers.ValidationError(
                    "Open and close time are required for open days that "
                    "are not 24 hours."
                )
        return attrs


class MerchantApplicationOperatingHoursSerializer(serializers.Serializer):
    """Step 4 — replaces the full week in one call."""

    hours = OperatingHoursDaySerializer(many=True)
    current_step = serializers.IntegerField(write_only=True)
    highest_completed_step = serializers.IntegerField(write_only=True)

    def validate_hours(self, value):
        days_seen = [item["day"] for item in value]
        if len(days_seen) != len(set(days_seen)):
            raise serializers.ValidationError(
                "Each day can only be submitted once."
            )
        return value


class MerchantApplicationOperatingHoursReadSerializer(serializers.ModelSerializer):
    """Nested, read-only view of one day's operating hours."""

    day = serializers.CharField(source="MHRS_DAY", read_only=True)
    is_open = serializers.BooleanField(source="MHRS_IS_OPEN", read_only=True)
    is_24_hours = serializers.BooleanField(source="MHRS_IS_24_HOURS", read_only=True)
    open_time = serializers.TimeField(source="MHRS_OPEN_TIME", read_only=True)
    close_time = serializers.TimeField(source="MHRS_CLOSE_TIME", read_only=True)

    class Meta:
        model = MerchantApplicationOperatingHours
        fields = ("day", "is_open", "is_24_hours", "open_time", "close_time")