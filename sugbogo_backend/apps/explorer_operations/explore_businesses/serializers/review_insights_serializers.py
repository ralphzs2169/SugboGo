from rest_framework import serializers

from apps.shared.analytics.policy import current_policy, policy_scope
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

    state = serializers.SerializerMethodField()
    policy = serializers.SerializerMethodField()
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
    minimum_eligible_review_count = serializers.SerializerMethodField()
    analyzed_review_count = serializers.IntegerField(
        source="BRSU_ANALYZED_REVIEW_COUNT",
        read_only=True,
    )
    classified_review_count = serializers.IntegerField(
        source="BRSU_CLASSIFIED_REVIEW_COUNT",
        read_only=True,
    )
    has_sufficient_sentiment_data = serializers.SerializerMethodField()
    overall_vibe = serializers.CharField(
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
    sentiment_computed_at = serializers.DateTimeField(
        source="BRSU_SENTIMENT_COMPUTED_AT",
        read_only=True,
        allow_null=True,
    )
    updated_at = serializers.DateTimeField(
        source="BRSU_UPDATED_AT",
        read_only=True,
    )

    def to_representation(self, instance):
        """Resolve one policy snapshot even when serialization runs outside request middleware."""
        with policy_scope():
            return super().to_representation(instance)

    def get_policy(self, instance):
        """Disclose current and original policy separately without relabeling older content."""
        policy = current_policy()
        generated = instance.BRSU_GENERATION_POLICY_VALUES
        return {"current_version": policy.version,
                "generated_version": instance.BRSU_GENERATION_POLICY_VERSION,
                "provenance": "legacy_unknown" if instance.BRSU_GENERATION_POLICY_VERSION is None else "recorded",
                "generation_rules_match": None if not generated else generated == policy.review_rules,
                "thresholds": {name: policy[name] for name in (
                    "sentiment_min_classified_reviews", "narrative_min_eligible_reviews", "mention_min_supporting_reviews")}}

    def get_state(self, instance):
        """Label incompatible stored generation rules outdated without writing during a read."""
        generated = instance.BRSU_GENERATION_POLICY_VALUES
        if (generated and generated != current_policy().review_rules
                and instance.BRSU_GENERATION_STATE in {BusinessReviewSummary.GenerationState.READY, BusinessReviewSummary.GenerationState.OUTDATED, BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS}):
            return BusinessReviewSummary.GenerationState.OUTDATED
        if (instance.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.READY
                and instance.BRSU_ELIGIBLE_REVIEW_COUNT < current_policy()["narrative_min_eligible_reviews"]):
            return BusinessReviewSummary.GenerationState.OUTDATED
        return instance.BRSU_GENERATION_STATE

    def _has_publishable_content(self, instance):
        """Retain stored content only when it meets current narrative eligibility and existing evidence state."""
        if instance.BRSU_GENERATION_STATE not in {
            BusinessReviewSummary.GenerationState.READY,
            BusinessReviewSummary.GenerationState.OUTDATED,
        }:
            return False
        return bool((instance.BRSU_NARRATIVE or "").strip()) and (
            instance.BRSU_ELIGIBLE_REVIEW_COUNT >= current_policy()["narrative_min_eligible_reviews"]
        )

    def get_state_message(self, instance):
        """Explain policy-based unavailability and retained stale content using the effective rules."""
        if (instance.BRSU_GENERATION_STATE != BusinessReviewSummary.GenerationState.PENDING
                and instance.BRSU_ELIGIBLE_REVIEW_COUNT < current_policy()["narrative_min_eligible_reviews"]):
            minimum = current_policy()["narrative_min_eligible_reviews"]
            if minimum == 5:
                return self.STATE_MESSAGES[BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS]
            return f"At least {minimum} eligible recent reviews are required."
        if (instance.BRSU_GENERATION_POLICY_VALUES
                and instance.BRSU_GENERATION_POLICY_VALUES != current_policy().review_rules
                and self.get_state(instance) == BusinessReviewSummary.GenerationState.OUTDATED):
            return "Review insight policy changed; stored insights are awaiting refresh."
        if instance.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS:
            minimum = current_policy()["narrative_min_eligible_reviews"]
            if minimum == 5:
                return self.STATE_MESSAGES[BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS]
            return f"At least {minimum} eligible recent reviews are required."
        if (
            self.get_state(instance)
            == BusinessReviewSummary.GenerationState.OUTDATED
        ):
            if self._has_publishable_content(instance):
                return "Review insights are outdated and awaiting refresh."
            return (
                "Review insights are unavailable because supporting reviews changed."
            )
        return self.STATE_MESSAGES.get(instance.BRSU_GENERATION_STATE)

    def get_content_available(self, instance):
        """Report current policy eligibility without regenerating or modifying stored content."""
        return self._has_publishable_content(instance)

    def get_narrative(self, instance):
        """Return a stored narrative only when its current rendering gate permits it."""
        if not self._has_publishable_content(instance):
            return None
        return instance.BRSU_NARRATIVE

    def get_frequent_mentions(self, instance):
        """Filter stored mentions by current support requirements without adding polarity."""
        if not self._has_publishable_content(instance):
            return []
        return FrequentMentionSerializer(
            [tag for tag in instance.BRSU_KEYWORD_TAGS if isinstance(tag, dict)
             and type(tag.get("count")) is int and tag["count"] >= current_policy()["mention_min_supporting_reviews"]],
            many=True,
        ).data

    def get_is_sampled(self, instance):
        """Disclose the original generation sample rather than inventing new coverage."""
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

    def get_has_sufficient_sentiment_data(self, instance):
        """Reports whether the stored classified count meets the display threshold."""
        return (
            instance.BRSU_CLASSIFIED_REVIEW_COUNT
            >= current_policy()["sentiment_min_classified_reviews"]
        )

    @staticmethod
    def get_minimum_eligible_review_count(_instance):
        """Expose the effective narrative threshold to existing frontend consumers."""
        return current_policy()["narrative_min_eligible_reviews"]

    class Meta:
        model = BusinessReviewSummary
        fields = (
            "policy",
            "state",
            "state_message",
            "content_available",
            "narrative",
            "review_count",
            "eligible_review_count",
            "minimum_eligible_review_count",
            "analyzed_review_count",
            "classified_review_count",
            "has_sufficient_sentiment_data",
            "overall_vibe",
            "is_sampled",
            "sentiment",
            "frequent_mentions",
            "coverage_start",
            "coverage_end",
            "generated_at",
            "sentiment_computed_at",
            "updated_at",
        )
