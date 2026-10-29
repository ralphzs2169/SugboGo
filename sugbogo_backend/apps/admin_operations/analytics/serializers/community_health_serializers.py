"""Retained publication cohorts and pooled stored sentiment contracts."""

from rest_framework import serializers

from .platform_analytics_serializers import AnalyticsMetaSerializer
from .reporting_serializers import CountComparisonSerializer


class ReviewInventorySerializer(serializers.Serializer):
    """Expose current retained moderation states without implying historical inventory."""

    measurement_type = serializers.ChoiceField(choices=("current_snapshot",))
    selected_period_applies = serializers.BooleanField()
    as_of = serializers.CharField()
    retained_reviews = serializers.IntegerField()
    published = serializers.IntegerField()
    under_review = serializers.IntegerField()
    flagged = serializers.IntegerField()
    rejected = serializers.IntegerField()


class SentimentShareSerializer(serializers.Serializer):
    """Describe classified counts and nullable shares on a zero-to-one-hundred scale."""

    count = serializers.IntegerField()
    percentage = serializers.FloatField(allow_null=True)


class SentimentSerializer(serializers.Serializer):
    """Preserve only existing positive, neutral and negative labels."""

    positive = SentimentShareSerializer()
    neutral = SentimentShareSerializer()
    negative = SentimentShareSerializer()


class ReviewCohortSerializer(serializers.Serializer):
    """Keep unclassified reviews outside the sentiment denominator."""

    published_review_count = serializers.IntegerField()
    classified_review_count = serializers.IntegerField()
    unclassified_review_count = serializers.IntegerField()
    sentiment = SentimentSerializer()


class ReviewCohortSeriesSerializer(ReviewCohortSerializer):
    """Associate pooled review counts with a clipped reporting bucket."""

    date = serializers.CharField()
    start = serializers.CharField()
    end_exclusive = serializers.CharField()


class CommunityHealthSerializer(serializers.Serializer):
    """Expose current-state review cohorts without ratings or private review content."""

    inventory = ReviewInventorySerializer()
    measurement_type = serializers.ChoiceField(choices=("period_current_state",))
    current = ReviewCohortSerializer()
    previous = ReviewCohortSerializer()
    published_review_count_change = CountComparisonSerializer()
    interval = serializers.ChoiceField(choices=("daily", "weekly"))
    series = ReviewCohortSeriesSerializer(many=True)
    series_is_sparse = serializers.BooleanField()
    definition = serializers.CharField()
    meta = AnalyticsMetaSerializer()
