from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationOperatingHours


class OperatingHoursDaySerializer(serializers.Serializer):
    """Handles a single day's operating hours payload."""

    day = serializers.ChoiceField(
        choices=MerchantApplicationOperatingHours.Day.choices,
        error_messages={
            "required": "Day is required.",
            "invalid_choice": "Please select a valid day.",
        },
    )
    is_open = serializers.BooleanField(
        error_messages={
            "required": "Please specify whether this day is open.",
            "invalid": "Please provide a valid open/closed value.",
        },
    )
    is_24_hours = serializers.BooleanField(
        default=False,
        error_messages={
            "invalid": "Please provide a valid 24-hour setting.",
        },
    )
    open_time = serializers.TimeField(
        required=False,
        allow_null=True,
        error_messages={
            "invalid": "Please provide a valid opening time.",
        },
    )
    close_time = serializers.TimeField(
        required=False,
        allow_null=True,
        error_messages={
            "invalid": "Please provide a valid closing time.",
        },
    )

    def validate(self, attrs):
        is_open = attrs.get("is_open")
        is_24_hours = attrs.get("is_24_hours")
        open_time = attrs.get("open_time")
        close_time = attrs.get("close_time")

        # Closed days do not have operating times.
        if not is_open:
            attrs["open_time"] = None
            attrs["close_time"] = None
            attrs["is_24_hours"] = False
            return attrs

        # 24-hour days do not have specific opening/closing times.
        if is_24_hours:
            attrs["open_time"] = None
            attrs["close_time"] = None
            return attrs

        # Normal open days require both times.
        if not open_time or not close_time:
            raise serializers.ValidationError(
                "Open and close time are required for open days "
                "that are not 24 hours."
            )

        # Opening and closing times cannot be identical.
        if open_time == close_time:
            raise serializers.ValidationError(
                "Closing time must be different from opening time."
            )

        return attrs


class ApplicationOperatingHoursSerializer(serializers.Serializer):
    """Handles the complete weekly operating hours payload."""

    hours = OperatingHoursDaySerializer(
        many=True,
        error_messages={
            "required": "Operating hours are required.",
            "empty": "Operating hours cannot be empty.",
        },
    )

    def validate_hours(self, value):
        days_seen = [item["day"] for item in value]

        # Ensure that each day is only submitted once and that all seven days are present.
        if len(days_seen) != len(set(days_seen)):
            raise serializers.ValidationError(
                "Each day can only be submitted once."
            )

        expected_days = {
            choice[0]
            for choice in MerchantApplicationOperatingHours.Day.choices
        }

        if set(days_seen) != expected_days:
            raise serializers.ValidationError(
                "All seven days must be submitted."
            )

        if not any(item["is_open"] for item in value):
            raise serializers.ValidationError(
                "At least one day must be open."
            )

        return value


class ApplicationOperatingHoursReadSerializer(serializers.ModelSerializer):
    """Read-only representation of one day's operating hours."""

    day = serializers.CharField(source="MHRS_DAY", read_only=True)
    is_open = serializers.BooleanField(source="MHRS_IS_OPEN", read_only=True)
    is_24_hours = serializers.BooleanField(
        source="MHRS_IS_24_HOURS",
        read_only=True,
    )
    open_time = serializers.TimeField(
        source="MHRS_OPEN_TIME",
        read_only=True,
    )
    close_time = serializers.TimeField(
        source="MHRS_CLOSE_TIME",
        read_only=True,
    )

    class Meta:
        model = MerchantApplicationOperatingHours
        fields = (
            "day",
            "is_open",
            "is_24_hours",
            "open_time",
            "close_time",
        )