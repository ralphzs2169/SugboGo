from rest_framework import serializers

from apps.merchant_operations.merchant_analytics.serializers.standard_analytics_serializers import (
    OwnedBusinessSerializer,
)


class RecentActivityQuerySerializer(serializers.Serializer):
    """Keep dashboard activity independent of client ownership and reporting filters."""

    def validate(
        self,
        attrs,
    ):
        """Reject query parameters for this fixed five-row current snapshot."""
        if self.initial_data:
            raise serializers.ValidationError({
                key: "Recent activity does not accept query parameters."
                for key in sorted(self.initial_data)
            })
        return attrs


class ActivityTargetSerializer(serializers.Serializer):
    """Expose only the confirmed specific-review destination."""

    type = serializers.ChoiceField(choices=("business_review",))
    id = serializers.IntegerField(min_value=1)


class ActivitySpecialtySerializer(serializers.Serializer):
    """Expose a public specialty identifier and name."""

    id = serializers.IntegerField(min_value=1)
    name = serializers.CharField()


class RecentActivityItemSerializer(serializers.Serializer):
    """Allowlist activity presentation while keeping saver identities private."""

    id = serializers.CharField()
    type = serializers.ChoiceField(choices=("review", "vouch", "save"))
    occurred_at = serializers.DateTimeField()
    date = serializers.DateField()
    time_basis = serializers.ChoiceField(choices=(
        "published_at",
        "created_at_fallback",
        "latest_vouch",
        "latest_save",
    ))
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    actor_name = serializers.CharField(allow_null=True)
    count = serializers.IntegerField(min_value=1)
    specialties = ActivitySpecialtySerializer(many=True)
    remaining_specialties = serializers.IntegerField(min_value=0)
    target = ActivityTargetSerializer(allow_null=True)


class ActivityGroupingSerializer(serializers.Serializer):
    """Declare calendar grouping independently of inbox grouping and read status."""

    vouches = serializers.ChoiceField(choices=("explorer_day",))
    saves = serializers.ChoiceField(choices=("day",))


class SaveActivitySourceSerializer(serializers.Serializer):
    """Distinguish unavailable save tracking from a healthy empty result."""

    availability = serializers.ChoiceField(choices=("available", "unavailable"))
    coverage = serializers.ChoiceField(choices=("recorded_events_only",))


class ActivitySourcesSerializer(serializers.Serializer):
    """Describe optional tracking coverage without exposing analytics identities."""

    saves = SaveActivitySourceSerializer()


class RecentActivitySerializer(serializers.Serializer):
    """Expose the latest owned-business activities with explicit source limitations."""

    business = OwnedBusinessSerializer()
    items = RecentActivityItemSerializer(many=True)
    snapshot_as_of = serializers.DateTimeField()
    is_partial = serializers.BooleanField()
    timezone = serializers.ChoiceField(choices=("Asia/Manila",))
    grouping = ActivityGroupingSerializer()
    sources = ActivitySourcesSerializer()
