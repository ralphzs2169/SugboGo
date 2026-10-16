"""Bounded export selections using the existing report period and interval contract."""

from rest_framework import serializers

from .premium_analytics_serializers import PremiumVisibilityQuerySerializer


class ReportExportQuerySerializer(PremiumVisibilityQuerySerializer):
    """Validate the existing report selection within the synchronous PDF export bounds."""

    MAX_DAYS = 366

    def validate(self, attrs):
        """Reject repeated inputs and resolve one reporting clock before enforcing the export limit."""
        if hasattr(self.initial_data, "getlist"):
            repeated = [key for key in self.initial_data if len(self.initial_data.getlist(key)) > 1]
            if repeated:
                raise serializers.ValidationError({key: "Provide this parameter only once." for key in repeated})
        attrs = super().validate(attrs)
        period = attrs["report_period"]
        if (period.end_date - period.start_date).days + 1 > self.MAX_DAYS:
            raise serializers.ValidationError({"period": "PDF exports support at most 366 calendar days."})
        return attrs
