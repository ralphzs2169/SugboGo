"""Approved analytics controls, with non-editable safety floors and resource bounds."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PolicyField:
    """Describe one integer rule for persistence, validation, and the settings interface."""

    model_field: str
    default: int
    minimum: int
    maximum: int
    unit: str
    label: str


POLICY_FIELDS = {
    "sentiment_min_classified_reviews": PolicyField("APC_SENTIMENT_MIN_REVIEWS", 5, 5, 1000, "classified_reviews", "Minimum classified reviews for sentiment conclusions"),
    "narrative_min_eligible_reviews": PolicyField("APC_NARRATIVE_MIN_REVIEWS", 5, 5, 100, "eligible_text_reviews", "Minimum eligible reviews for narrative generation"),
    "mention_min_supporting_reviews": PolicyField("APC_MENTION_MIN_REVIEWS", 2, 2, 100, "supporting_reviews", "Minimum reviews supporting a frequent mention"),
    "peer_min_businesses": PolicyField("APC_PEER_MIN_BUSINESSES", 5, 5, 100, "other_businesses", "Minimum other businesses in a disclosed peer group"),
    "peer_positive_share_min_reviews": PolicyField("APC_PEER_MIN_REVIEWS", 5, 5, 1000, "classified_reviews_per_business", "Minimum classified reviews per business for positive-share peers"),
    "low_exposure_max_profile_visits": PolicyField("APC_LOW_EXPOSURE_MAX_VISITS", 4, 0, 100, "recorded_profile_visits", "Maximum visits for low-exposure selection"),
    "low_exposure_min_distinct_supporters": PolicyField("APC_LOW_EXPOSURE_MIN_SUPPORTERS", 5, 5, 1000, "distinct_valid_supporters", "Minimum supporters for low-exposure selection"),
    "onboarding_comparison_min_sample": PolicyField("APC_ONBOARDING_MIN_SAMPLE", 10, 10, 1000, "observations_per_period", "Minimum sample in each onboarding comparison period"),
}

# Product-approved fixed definitions are displayed, never accepted as client overrides.
FIXED_POLICY = {"low_exposure_window_days": 30, "low_exposure_excludes_today": True,
                "review_generation_max_analyzed_reviews": 100, "visibility_coverage_configurable": False}
REVIEW_GENERATION_FIELDS = ("narrative_min_eligible_reviews", "mention_min_supporting_reviews")
