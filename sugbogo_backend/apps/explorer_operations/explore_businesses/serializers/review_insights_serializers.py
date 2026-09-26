from rest_framework import serializers

from apps.reviews.models import BusinessReviewSummary


class FrequentMentionSerializer(serializers.Serializer):
    """Exposes stored keyword labels and counts without supporting review IDs."""

    label = serializers.CharField(source="text", read_only=True)
    count = serializers.IntegerField(read_only=True)


class BusinessReviewInsightsSerializer(serializers.ModelSerializer):
    """Exposes public insights from the stored summary without processing reviews."""

    STATE_MESSAGES = {
        BusinessReviewSummary.GenerationState.PENDING: (
            "Review insights are being generated."
        ),
        BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS: (
            "At least five eligible recent reviews are required."
        ),
        BusinessReviewSummary.GenerationState.READY: "Review insights are ready.",
    }

    state = serializers.CharField(
        source="BRSU_GENERATION_STATE",
        read_only=True,
    )
    state_message = serializers.SerializerMethodField()
    content_available = serializers.SerializerMethodField()
    narrative = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(
        source="BRSU_REVIEW_COUNT",
        read_only=True,
    )
    eligible_review_count = serializers.IntegerField(
        source="BRSU_ELIGIBLE_REVIEW_COUNT",
        read_only=True,
    )
    analyzed_review_count = serializers.IntegerField(
        source="BRSU_ANALYZED_REVIEW_COUNT",
        read_only=True,
    )
    classified_review_count = serializers.IntegerField(
        source="BRSU_CLASSIFIED_REVIEW_COUNT",
        read_only=True,
    )
    is_sampled = serializers.SerializerMethodField()
    sentiment = serializers.SerializerMethodField()
    frequent_mentions = serializers.SerializerMethodField()
    coverage_start = serializers.DateTimeField(
        source="BRSU_COVERAGE_START",
        read_only=True,
        allow_null=True,
    )
    coverage_end = serializers.DateTimeField(
        source="BRSU_COVERAGE_END",
        read_only=True,
        allow_null=True,
    )
    generated_at = serializers.DateTimeField(
        source="BRSU_GENERATED_AT",
        read_only=True,
        allow_null=True,
    )
    updated_at = serializers.DateTimeField(
        source="BRSU_UPDATED_AT",
        read_only=True,
    )

    @staticmethod
    def _has_publishable_content(instance):
        if instance.BRSU_GENERATION_STATE not in {
            BusinessReviewSummary.GenerationState.READY,
            BusinessReviewSummary.GenerationState.OUTDATED,
        }:
            return False
        return bool((instance.BRSU_NARRATIVE or "").strip())

    def get_state_message(self, instance):
        if (
            instance.BRSU_GENERATION_STATE
            == BusinessReviewSummary.GenerationState.OUTDATED
        ):
            if self._has_publishable_content(instance):
                return "Review insights are outdated and awaiting refresh."
            return "Review insights are unavailable because supporting reviews changed."
        return self.STATE_MESSAGES.get(instance.BRSU_GENERATION_STATE)

    def get_content_available(self, instance):
        return self._has_publishable_content(instance)

    def get_narrative(self, instance):
        if not self._has_publishable_content(instance):
            return None
        return instance.BRSU_NARRATIVE

    def get_frequent_mentions(self, instance):
        if not self._has_publishable_content(instance):
            return []
        return FrequentMentionSerializer(
            instance.BRSU_KEYWORD_TAGS,
            many=True,
        ).data

    def get_is_sampled(self, instance):
        return (
            instance.BRSU_ANALYZED_REVIEW_COUNT > 0
            and instance.BRSU_ANALYZED_REVIEW_COUNT
            < instance.BRSU_ELIGIBLE_REVIEW_COUNT
        )

    def get_sentiment(self, instance):
        """Preserves the model's percentages based on stored classified counts."""
        percentages = instance.sentiment_percentages
        return {
            label: {
                "count": getattr(instance, f"BRSU_{label.upper()}_COUNT"),
                "percentage": percentage,
            }
            for label, percentage in percentages.items()
        }

    class Meta:
        model = BusinessReviewSummary
        fields = (
            "state",
            "state_message",
            "content_available",
            "narrative",
            "review_count",
            "eligible_review_count",
            "analyzed_review_count",
            "classified_review_count",
            "is_sampled",
            "sentiment",
            "frequent_mentions",
            "coverage_start",
            "coverage_end",
            "generated_at",
            "updated_at",
        )
