"""Strict input and output contracts for the current unanswered-review snapshot."""

from rest_framework import serializers

from .standard_analytics_serializers import OwnedBusinessSerializer


class AgedUnansweredReviewsQuerySerializer(serializers.Serializer):
    """Accept no client-selected business, cutoff, or reporting-period parameters."""

    def validate(
        self,
        attrs,
    ):
        """Reject query parameters so this snapshot cannot become a period-filtered report."""
        if self.initial_data:
            raise serializers.ValidationError(
                {
                    key: "This current snapshot does not accept query parameters."
                    for key in sorted(self.initial_data)
                },
            )
        return attrs


class AgedUnansweredReviewsSerializer(serializers.Serializer):
    """Expose aggregate age counts without review content or explorer identities."""

    business = OwnedBusinessSerializer()
    total_unanswered = serializers.IntegerField(min_value=0)
    under_3_days = serializers.IntegerField(min_value=0)
    days_3_to_6 = serializers.IntegerField(min_value=0)
    days_7_plus = serializers.IntegerField(min_value=0)
    snapshot_as_of = serializers.CharField()
