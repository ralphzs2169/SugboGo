"""Share the established review-vibe definition across stored and selected cohorts."""

from apps.shared.analytics.policy import current_policy


def classify_review_vibe(
    counts,
    classified_count,
):
    """Return the established dominant category only when the policy sample is sufficient."""
    if classified_count < current_policy()["sentiment_min_classified_reviews"]:
        return None

    if classified_count:
        percentages = {
            label: count / classified_count * 100
            for label, count in counts.items()
        }
    else:
        percentages = dict.fromkeys(counts, 0.0)
    ranked_sentiments = sorted(
        percentages.items(),
        key=lambda item: item[1],
        reverse=True,
    )
    top_label = ranked_sentiments[0][0]
    top_percentage = ranked_sentiments[0][1]
    second_percentage = ranked_sentiments[1][1]

    if (
        top_percentage >= 55
        and top_percentage - second_percentage >= 15
    ):
        return f"mostly_{top_label}"

    return "mixed"
