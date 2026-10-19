"""Premium query validation and aggregate response allowlists."""

from datetime import timedelta

from rest_framework import serializers

from apps.shared.analytics.date_ranges import resolve_period

from .standard_analytics_serializers import OwnedBusinessSerializer, StandardAnalyticsQuerySerializer


class PremiumSnapshotQuerySerializer(StandardAnalyticsQuerySerializer):
    """Optionally align an individual Plus read to a recent Standard reporting cutoff."""

    as_of = serializers.DateTimeField(required=False)

    def validate(
        self,
        attrs,
    ):
        """Bound client cutoffs using the server clock without changing default selections."""
        attrs = super().validate(attrs)
        cutoff = attrs.get("as_of")
        if cutoff is None:
            return attrs
        now = attrs["report_period"].generated_at
        if cutoff > now or now - cutoff > timedelta(minutes=5):
            raise serializers.ValidationError(
                {
                    "as_of": (
                        "Use a reporting cutoff from the last five minutes, "
                        "not a future time."
                    ),
                },
            )
        attrs["report_period"] = resolve_period(
            preset=attrs["period"],
            start_date=attrs.get("start_date"),
            end_date=attrs.get("end_date"),
            now=cutoff,
        )
        return attrs


class PremiumVisibilityQuerySerializer(PremiumSnapshotQuerySerializer):
    """Accept only approved periods and Manila daily or weekly reporting buckets."""

    interval = serializers.ChoiceField(choices=("daily", "weekly"), default="daily")


class ChangeSerializer(serializers.Serializer):
    """Describe a numerical change or the explicit reason it is unavailable."""

    value = serializers.FloatField(allow_null=True)
    direction = serializers.CharField(allow_null=True)
    unit = serializers.CharField()
    reason = serializers.CharField(allow_null=True)


class CountChangeSerializer(ChangeSerializer):
    """Expose an absolute count difference as an integer, including zero."""

    value = serializers.IntegerField(allow_null=True)


class BucketSerializer(serializers.Serializer):
    """Expose clipped reporting boundaries without event identities."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()


class EventBucketSerializer(BucketSerializer):
    """Expose one aggregate event or distinct-explorer count per bucket."""

    value = serializers.IntegerField()


class EventMetricSerializer(serializers.Serializer):
    """Keep failed tracking null and independent current and prior source metadata."""

    value = serializers.IntegerField(allow_null=True)
    previous_value = serializers.IntegerField(allow_null=True)
    change = ChangeSerializer()
    series = EventBucketSerializer(many=True, allow_null=True)
    series_is_sparse = serializers.BooleanField()
    sources = serializers.DictField(child=serializers.JSONField())
    comparison_eligibility = serializers.JSONField()


class PremiumReportSerializer(serializers.Serializer):
    """Expose only the owned business and shared aggregate reporting metadata."""

    business = OwnedBusinessSerializer()
    meta = serializers.JSONField()


class PremiumVisibilitySerializer(PremiumReportSerializer):
    """Allow Premium visibility or Pocket metrics without raw tracking events."""

    interval = serializers.CharField()
    metrics = serializers.DictField(child=EventMetricSerializer())
    measurement_note = serializers.CharField()


class SpecialtyBucketSerializer(BucketSerializer):
    """Keep retained endorsement counts separate from distinct supporters."""

    added_and_still_valid = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()


class SpecialtyTrendSerializer(serializers.Serializer):
    """Expose current specialty identities and retained valid creation cohorts."""

    specialty_id = serializers.IntegerField()
    specialty_name = serializers.CharField()
    added_and_still_valid = serializers.IntegerField()
    distinct_supporters = serializers.IntegerField()
    series = SpecialtyBucketSerializer(many=True)


class PremiumSpecialtySerializer(PremiumReportSerializer):
    """Explicitly label surviving rows rather than presenting a historical support balance."""

    interval = serializers.CharField()
    label = serializers.CharField()
    specialties = SpecialtyTrendSerializer(many=True)
    snapshot_as_of = serializers.CharField()
    vouches_added_and_still_valid = serializers.IntegerField()
    previous_vouches_added_and_still_valid = serializers.IntegerField()
    vouches_added_change = CountChangeSerializer()


class PremiumReviewInsightsSerializer(PremiumReportSerializer):
    """Wrap the existing public serializer's sanitized stored-insights contract."""

    # The service builds this through BusinessReviewInsightsSerializer, never raw model JSON.
    stored_summary = serializers.JSONField(allow_null=True)
    measurement_note = serializers.CharField()


class SentimentMeasureSerializer(serializers.Serializer):
    """Expose counts and shares based solely on classified reviews."""

    count = serializers.IntegerField()
    percentage = serializers.FloatField(allow_null=True)


class ReviewMeasuresSerializer(serializers.Serializer):
    """Expose pooled published-review cohorts and stored sentiment denominators."""

    published_review_count = serializers.IntegerField()
    replied_review_count = serializers.IntegerField()
    unanswered_cohort_count = serializers.IntegerField()
    reply_rate = serializers.FloatField(allow_null=True)
    classified_review_count = serializers.IntegerField()
    unclassified_review_count = serializers.IntegerField()
    has_sufficient_sentiment_data = serializers.BooleanField()
    sentiment = serializers.DictField(child=SentimentMeasureSerializer())


class ReviewCohortSerializer(ReviewMeasuresSerializer):
    """Expose a retained-reply median with its replied-review sample size."""

    median_first_reply_seconds = serializers.FloatField(allow_null=True)
    median_replied_sample_size = serializers.IntegerField()
    overall_vibe = serializers.ChoiceField(
        choices=(
            "mostly_positive",
            "mostly_neutral",
            "mostly_negative",
            "mixed",
        ),
        allow_null=True,
    )


class ReviewBucketSerializer(ReviewMeasuresSerializer, BucketSerializer):
    """Expose weekly review-creation cohorts using the same pooled definitions."""


class PremiumReviewPerformanceSerializer(PremiumReportSerializer):
    """Keep selected review cohorts distinct from current unanswered backlog."""

    policy_version = serializers.IntegerField()
    interval = serializers.CharField()
    current = ReviewCohortSerializer()
    previous = ReviewCohortSerializer()
    reply_rate_change = ChangeSerializer()
    published_review_count_change = CountChangeSerializer()
    series = ReviewBucketSerializer(many=True)
    current_unanswered_published = serializers.IntegerField()
    reply_cutoff = serializers.CharField()
    excluded_reply_timestamp_count = serializers.IntegerField()
    measurement_note = serializers.CharField()
