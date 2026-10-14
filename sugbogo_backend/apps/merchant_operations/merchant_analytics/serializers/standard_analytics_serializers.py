"""Standard request validation and strict non-Premium output allowlists."""

from rest_framework import serializers

from apps.shared.analytics.date_ranges import resolve_period


class StandardAnalyticsQuerySerializer(serializers.Serializer):
    """Accept dates only; neither ownership nor entitlement can come from the client."""

    period = serializers.ChoiceField(choices=("7", "30", "90", "custom"), default="30")
    start_date = serializers.DateField(required=False, input_formats=("%Y-%m-%d",))
    end_date = serializers.DateField(required=False, input_formats=("%Y-%m-%d",))

    def validate(self, attrs):
        """Reject unknown inputs and capture a single server-side reporting clock."""
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Unsupported analytics query parameter." for key in sorted(unknown)})
        attrs["report_period"] = resolve_period(
            preset=attrs["period"], start_date=attrs.get("start_date"), end_date=attrs.get("end_date"),
        )
        return attrs


class StandardPeriodSerializer(serializers.Serializer):
    """Expose only current selected dates and effective boundaries."""

    timezone = serializers.CharField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()


class StandardMetaSerializer(serializers.Serializer):
    """Expose data limitations without shared-helper comparison boundaries."""

    period = StandardPeriodSerializer()
    data_through = serializers.CharField(allow_null=True)
    generated_at = serializers.CharField()
    availability = serializers.ChoiceField(choices=("available", "partial", "unavailable"))
    is_partial = serializers.BooleanField()
    partial_reason = serializers.CharField(allow_null=True)
    partial_reasons = serializers.ListField(child=serializers.CharField())
    coverage_verified = serializers.BooleanField()


class OwnedBusinessSerializer(serializers.Serializer):
    """Expose the caller's owned business identifier without personal location fields."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()


class SpecialtySupportSerializer(serializers.Serializer):
    """Keep valid endorsement counts distinct from supporter counts per specialty."""

    specialty_id = serializers.IntegerField()
    specialty_name = serializers.CharField()
    valid_vouches = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()


class StandardReviewsSerializer(serializers.Serializer):
    """Disclose reply-rate cohort and cutoff separately from current unanswered backlog."""

    new_published_in_period = serializers.IntegerField()
    current_published_total = serializers.IntegerField()
    current_unanswered_published = serializers.IntegerField()
    period_eligible_published = serializers.IntegerField()
    period_replied_published = serializers.IntegerField()
    reply_rate = serializers.FloatField(allow_null=True)
    reply_cutoff = serializers.CharField()
    excluded_reply_timestamp_count = serializers.IntegerField()


class StandardSourcesSerializer(serializers.Serializer):
    """Keep SQL current-state metadata independent of Mongo visibility availability."""

    domain = StandardMetaSerializer()
    visibility = StandardMetaSerializer()


class StandardAnalyticsSerializer(serializers.Serializer):
    """Allow only approved Standard metrics; no comparison or Premium fields."""

    business = OwnedBusinessSerializer()
    profile_visits = serializers.IntegerField(allow_null=True)
    distinct_profile_visitors = serializers.IntegerField(allow_null=True)
    saves_in_period = serializers.IntegerField(allow_null=True)
    current_pocket_holders = serializers.IntegerField()
    specialty_support = SpecialtySupportSerializer(many=True)
    reviews = StandardReviewsSerializer()
    snapshot_as_of = serializers.CharField()
    meta = StandardMetaSerializer()
    sources = StandardSourcesSerializer()
