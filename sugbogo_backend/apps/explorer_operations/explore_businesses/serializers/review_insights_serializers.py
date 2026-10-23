from rest_framework import serializers
from django.utils import timezone

from apps.shared.analytics.policy import current_policy, policy_scope
from apps.reviews.models import BusinessReviewSummary, ReviewInsightRegeneration


class FrequentMentionSerializer(serializers.Serializer):
    """Exposes stored keyword labels and counts without supporting review IDs."""

    label = serializers.CharField(source="text", read_only=True)
    count = serializers.IntegerField(read_only=True)


class ReviewInsightRegenerationSerializer(serializers.Serializer):
    """Expose read-only progress from durable demand without disclosing worker ownership."""

    status = serializers.CharField(read_only=True)
    is_outstanding = serializers.BooleanField(read_only=True)
    requested_revision = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )
    completed_revision = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )
    run_after = serializers.DateTimeField(
        read_only=True,
        allow_null=True,
    )
    content_available = serializers.BooleanField(read_only=True)
    content_is_current = serializers.BooleanField(read_only=True)

    def to_representation(
        self,
        business,
    ):
        """Project current revisions, valid ownership and backoff without changing work."""
        with policy_scope():
            work = getattr(business, "review_insight_regeneration", None)
            summary = getattr(business, "review_summary", None)
            insights = BusinessReviewInsightsSerializer(context=self.context)
            available = (
                summary is not None
                and insights._has_publishable_content(summary)
            )
            data = {
                "status": "untracked",
                "is_outstanding": False,
                "requested_revision": None,
                "completed_revision": None,
                "run_after": None,
                "content_available": available,
                "content_is_current": False,
            }
            if work is None:
                return super().to_representation(data)

            outstanding = work.RIRG_REQUESTED_REVISION > work.RIRG_COMPLETED_REVISION
            data.update({
                "status": "idle",
                "is_outstanding": outstanding,
                "requested_revision": work.RIRG_REQUESTED_REVISION,
                "completed_revision": work.RIRG_COMPLETED_REVISION,
            })
            if outstanding:
                now = timezone.now()
                processing = (
                    work.RIRG_ATTEMPT_TOKEN is not None
                    and work.RIRG_LEASE_EXPIRES_AT is not None
                    and work.RIRG_LEASE_EXPIRES_AT > now
                    and work.RIRG_CLAIMED_REVISION == work.RIRG_REQUESTED_REVISION
                )
                retry_wait = (
                    work.RIRG_RETRY_NOT_BEFORE is not None
                    and work.RIRG_RETRY_NOT_BEFORE > now
                )
                if processing:
                    data["status"] = "processing"
                elif retry_wait:
                    data["status"] = "retry_wait"
                else:
                    data["status"] = "scheduled"
                if (
                    not processing
                    and work.RIRG_OBSERVED_REVISION == work.RIRG_REQUESTED_REVISION
                    and work.RIRG_DUE_AT is not None
                ):
                    run_after = work.RIRG_DUE_AT
                    if work.RIRG_RETRY_NOT_BEFORE is not None:
                        run_after = max(
                            run_after,
                            work.RIRG_RETRY_NOT_BEFORE,
                        )
                    data["run_after"] = run_after
            data["content_is_current"] = bool(
                available
                and not outstanding
                and work.RIRG_COMPLETED_REVISION > 0
                and summary.BRSU_GENERATED_AT
                and work.RIRG_INPUT_FINGERPRINT
                and work.RIRG_INPUT_FINGERPRINT == summary.BRSU_KEYWORDS_FINGERPRINT
                and summary.BRSU_GENERATION_POLICY_VALUES == current_policy().review_rules
                and insights.get_state(summary) == BusinessReviewSummary.GenerationState.READY
            )
            return super().to_representation(data)


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
    regeneration = serializers.SerializerMethodField()
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

    def get_state(
        self,
        instance,
    ):
        """Label incompatible stored generation rules outdated without writing during a read."""
        if self._expiration_due(instance):
            return BusinessReviewSummary.GenerationState.OUTDATED
        work = getattr(instance.BUSN_ID, "review_insight_regeneration", None)
        if (
            work is not None
            and work.RIRG_REQUESTED_REVISION > work.RIRG_COMPLETED_REVISION
            and instance.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.READY
        ):
            return BusinessReviewSummary.GenerationState.OUTDATED
        generated = instance.BRSU_GENERATION_POLICY_VALUES
        if (generated and generated != current_policy().review_rules
                and instance.BRSU_GENERATION_STATE in {BusinessReviewSummary.GenerationState.READY, BusinessReviewSummary.GenerationState.OUTDATED, BusinessReviewSummary.GenerationState.INSUFFICIENT_REVIEWS}):
            return BusinessReviewSummary.GenerationState.OUTDATED
        if (instance.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.READY
                and instance.BRSU_ELIGIBLE_REVIEW_COUNT < current_policy()["narrative_min_eligible_reviews"]):
            return BusinessReviewSummary.GenerationState.OUTDATED
        return instance.BRSU_GENERATION_STATE

    def _has_publishable_content(
        self,
        instance,
    ):
        """Retain stored content only when it meets current narrative eligibility and existing evidence state."""
        if self._expiration_due(instance):
            return False
        generated_policy = instance.BRSU_GENERATION_POLICY_VALUES
        allowed_state = instance.BRSU_GENERATION_STATE in {
            BusinessReviewSummary.GenerationState.READY,
            BusinessReviewSummary.GenerationState.OUTDATED,
        }
        if instance.BRSU_GENERATION_STATE == BusinessReviewSummary.GenerationState.PENDING:
            # Coordinated generation retains a validated older bundle while the
            # provider runs; legacy pending rows have no such provenance.
            references = instance.BRSU_SUPPORTING_REVIEW_REFERENCES
            allowed_state = bool(
                getattr(instance.BUSN_ID, "review_insight_regeneration", None) is not None
                and instance.BRSU_GENERATED_AT
                and generated_policy == current_policy().review_rules
                and isinstance(references, dict)
                and references.get("narrative_review_ids")
            )
        if not allowed_state:
            return False
        return bool((instance.BRSU_NARRATIVE or "").strip()) and (
            instance.BRSU_ELIGIBLE_REVIEW_COUNT >= current_policy()["narrative_min_eligible_reviews"]
        )

    def get_regeneration(
        self,
        instance,
    ):
        """Reuse business progress for every consumer of stored insight content."""
        return ReviewInsightRegenerationSerializer(
            instance.BUSN_ID,
            context=self.context,
        ).data

    @staticmethod
    def _expiration_due(
        instance,
    ):
        """Hide elapsed evidence while the periodic expiry reconciliation catches up."""
        try:
            work = instance.BUSN_ID.review_insight_regeneration
        except ReviewInsightRegeneration.DoesNotExist:
            return False
        return (
            work.RIRG_RECHECK_AT is not None
            and work.RIRG_RECHECK_AT <= timezone.now()
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
            "regeneration",
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
