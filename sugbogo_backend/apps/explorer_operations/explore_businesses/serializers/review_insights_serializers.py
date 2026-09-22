from rest_framework import serializers

from apps.reviews.models import BusinessReviewSummary


class FrequentMentionSerializer(serializers.Serializer):
    """Exposes stored keyword labels and counts without supporting review IDs."""

    label = serializers.CharField(source="text", read_only=True)
    count = serializers.IntegerField(read_only=True)


class BusinessReviewInsightsSerializer(serializers.ModelSerializer):
    """Exposes public insights from the stored summary without processing reviews."""

    review_count = serializers.IntegerField(
        source="BRSU_REVIEW_COUNT",
        read_only=True,
    )
    sentiment = serializers.SerializerMethodField()
    frequent_mentions = FrequentMentionSerializer(
        source="BRSU_KEYWORD_TAGS",
        many=True,
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="BRSU_UPDATED_AT",
        read_only=True,
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
        fields = ("review_count", "sentiment", "frequent_mentions", "updated_at")
