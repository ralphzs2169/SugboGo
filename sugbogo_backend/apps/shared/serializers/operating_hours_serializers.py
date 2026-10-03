from rest_framework import serializers


DAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


class OperatingHoursDaySerializer(serializers.Serializer):
    """Validate and normalize one operating day for either business lifecycle."""

    day = serializers.ChoiceField(
        choices=[(day, day.title()) for day in DAYS],
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
        """Clear non-applicable times and reject incomplete ordinary hours."""

        is_open = attrs.get("is_open")
        is_24_hours = attrs.get("is_24_hours")
        open_time = attrs.get("open_time")
        close_time = attrs.get("close_time")

        if not is_open:
            attrs["open_time"] = None
            attrs["close_time"] = None
            attrs["is_24_hours"] = False
            return attrs

        if is_24_hours:
            attrs["open_time"] = None
            attrs["close_time"] = None
            return attrs

        if not open_time or not close_time:
            raise serializers.ValidationError(
                "Open and close time are required for open days "
                "that are not 24 hours."
            )

        if open_time == close_time:
            raise serializers.ValidationError(
                "Closing time must be different from opening time."
            )

        return attrs


class OperatingHoursWeekSerializer(serializers.Serializer):
    """Validate one complete seven-day operating schedule."""

    hours = OperatingHoursDaySerializer(
        many=True,
        error_messages={
            "required": "Operating hours are required.",
            "empty": "Operating hours cannot be empty.",
        },
    )

    def validate_hours(self, value):
        """Require each valid day exactly once and at least one open day."""

        days_seen = [item["day"] for item in value]

        if len(days_seen) != len(set(days_seen)):
            raise serializers.ValidationError(
                "Each day can only be submitted once."
            )

        if set(days_seen) != set(DAYS):
            raise serializers.ValidationError(
                "All seven days must be submitted."
            )

        if not any(item["is_open"] for item in value):
            raise serializers.ValidationError(
                "At least one day must be open."
            )

        return value
