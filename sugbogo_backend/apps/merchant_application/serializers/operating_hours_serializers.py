from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationOperatingHours
from apps.shared.serializers.operating_hours_serializers import (
    OperatingHoursDaySerializer,
    OperatingHoursWeekSerializer,
)


class ApplicationOperatingHoursSerializer(OperatingHoursWeekSerializer):
    """Validate a complete registration schedule with shared domain rules."""


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
