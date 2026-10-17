"""Published review cohorts, pooled stored sentiment, and retained reply performance."""

from statistics import median

from django.db.models import Count, Exists, F, OuterRef, Q
from django.db.models.functions import TruncWeek

from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.policy import current_policy, with_policy_snapshot
from apps.reviews.models import Review, ReviewReply
from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.date_ranges import MANILA

from .premium_common import owned_business_data, previous_period, snapshot_meta, week_buckets


class PremiumReviewPerformanceService:
    """Measure current published cohorts and replies retained by one server-side cutoff."""

    @staticmethod
    def count_expressions():
        """Provide pooled review counts with unclassified reviews outside sentiment denominators."""
        return {
            "published_review_count": Count("pk"),
            "replied_review_count": Count("pk", filter=Q(has_reply=True)),
            **{label: Count("pk", filter=Q(REVW_SENTIMENT_LABEL=label))
               for label in ("positive", "neutral", "negative")},
        }

    @staticmethod
    def measures(counts):
        """Compute shares from pooled classified counts and rates from published cohorts."""
        published = counts["published_review_count"]
        replied = counts["replied_review_count"]
        classified = sum(counts[label] for label in ("positive", "neutral", "negative"))
        return {
            "published_review_count": published, "replied_review_count": replied,
            "unanswered_cohort_count": published - replied,
            "reply_rate": round(replied / published * 100, 2) if published else None,
            "classified_review_count": classified,
            "unclassified_review_count": published - classified,
            "has_sufficient_sentiment_data": classified >= current_policy()["sentiment_min_classified_reviews"],
            "sentiment": {label: {"count": counts[label],
                                  "percentage": round(counts[label] / classified * 100, 2) if classified else None}
                          for label in ("positive", "neutral", "negative")},
        }

    @classmethod
    def cohort(cls, published, period):
        """Return selected cohort metrics and median duration among retained valid replies."""
        cohort = published.filter(REVW_CREATED_AT__gte=period.start, REVW_CREATED_AT__lt=period.end)
        measures = cls.measures(cohort.aggregate(**cls.count_expressions()))
        durations = list(cohort.filter(has_reply=True).annotate(
            duration=F("reply__RPLY_CREATED_AT") - F("REVW_CREATED_AT"),
        ).values_list("duration", flat=True))
        measures["median_first_reply_seconds"] = median(duration.total_seconds() for duration in durations) if durations else None
        measures["median_replied_sample_size"] = len(durations)
        return cohort, measures

    @classmethod
    @with_policy_snapshot
    def get_report(cls, user, period):
        """Expose weekly creation cohorts, current backlog, and equal-duration comparisons."""
        business = BusinessProfileService.get_business_for_merchant(user)
        eligible_reply = ReviewReply.objects.filter(
            REVW_ID=OuterRef("pk"), RPLY_CREATED_AT__gte=OuterRef("REVW_CREATED_AT"),
            RPLY_CREATED_AT__lte=period.generated_at,
        )
        # Preserve Standard's current published-state definition, not status transition history.
        published = Review.objects.filter(
            BUSN_ID=business.pk, REVW_STATUS=Review.ReviewStatus.PUBLISHED, REVW_CREATED_AT__lte=period.generated_at,
        ).annotate(has_reply=Exists(eligible_reply))
        cohort, current = cls.cohort(published, period)
        _, previous = cls.cohort(published, previous_period(period))
        weekly = cohort.annotate(week=TruncWeek("REVW_CREATED_AT", tzinfo=MANILA)).values("week").annotate(
            **cls.count_expressions(),
        ).order_by("week")
        rows = {row["week"].date().isoformat(): cls.measures(row) for row in weekly}
        empty = cls.measures({key: 0 for key in cls.count_expressions()})
        anomalies = ReviewReply.objects.filter(REVW_ID__in=published).filter(
            Q(RPLY_CREATED_AT__gt=period.generated_at) | Q(RPLY_CREATED_AT__lt=F("REVW_ID__REVW_CREATED_AT")),
        ).count()
        return {
            "business": owned_business_data(business), "policy_version": current_policy().version,
            "interval": "weekly", "current": current, "previous": previous,
            "reply_rate_change": compare_values(
                current=current["reply_rate"], previous=previous["reply_rate"],
                current_sample_size=current["published_review_count"], previous_sample_size=previous["published_review_count"],
                current_denominator=current["published_review_count"], previous_denominator=previous["published_review_count"],
                unit="percentage_points",
            ),
            "series": [{**bucket, **rows.get(bucket["date"], empty)} for bucket in week_buckets(period)],
            "current_unanswered_published": published.filter(has_reply=False).count(),
            "reply_cutoff": period.generated_at.isoformat(), "excluded_reply_timestamp_count": anomalies,
            "measurement_note": (
                "Replies are assessed at generated_at for reviews created in each cohort; recent cohorts have less time to receive replies. "
                "Median uses retained reply creation timestamps; deleting and recreating replies loses original first-reply history. "
                "Sentiment uses stored labels on current published reviews, not historical moderation or classification snapshots."
            ),
            "meta": snapshot_meta(period, "review_status_history_unavailable", "reply_deletion_history_unavailable",
                                  *(('reply_timestamp_anomalies',) if anomalies else ())),
        }
