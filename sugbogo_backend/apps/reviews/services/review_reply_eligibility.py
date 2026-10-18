"""Shared read-only review and reply eligibility for analytics and merchant lists."""

from django.db.models import Exists, OuterRef

from apps.reviews.models import Review, ReviewReply


def published_reviews_at_cutoff(
    business_id,
    cutoff,
):
    """Preserve Standard's published cohort and qualifying retained-reply annotation."""
    replies = ReviewReply.objects.filter(
        REVW_ID=OuterRef("pk"),
        RPLY_CREATED_AT__lte=cutoff,
        RPLY_CREATED_AT__gte=OuterRef("REVW_CREATED_AT"),
    )
    return Review.objects.filter(
        BUSN_ID=business_id,
        REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        REVW_CREATED_AT__lte=cutoff,
    ).annotate(has_eligible_reply=Exists(replies))


def actionable_unanswered_reviews(
    business_id,
    cutoff,
):
    """Exclude any retained reply because even malformed replies block a second reply."""
    return published_reviews_at_cutoff(
        business_id,
        cutoff,
    ).filter(
        has_eligible_reply=False,
        reply__isnull=True,
    )
