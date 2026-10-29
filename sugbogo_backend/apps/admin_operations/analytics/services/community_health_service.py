"""Platform review cohorts using retained publication state and stored sentiment labels."""

from django.db.models import Count, Q

from apps.reviews.models import Review
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.shared.analytics.comparisons import compare_count_difference, equal_elapsed_periods
from apps.shared.analytics.metadata import build_meta

from .reporting_helpers import calendar_buckets, grouped_time_counts


class CommunityHealthService:
    """Pool review evidence directly without querying individual merchant reports."""

    LABELS = BusinessReviewSummaryService.SENTIMENT_LABELS

    @classmethod
    def count_expressions(cls):
        """Match merchant reporting's recognized-label denominator and published cohort count."""
        return {
            "published_review_count": Count("pk"),
            **{
                label: Count("pk", filter=Q(REVW_SENTIMENT_LABEL=label))
                for label in cls.LABELS
            },
        }

    @classmethod
    def measures(
        cls,
        counts,
    ):
        """Keep unclassified reviews outside pooled sentiment percentages."""
        classified = sum(
            counts[label]
            for label in cls.LABELS
        )
        sentiment = {}
        for label in cls.LABELS:
            if classified:
                percentage = round(counts[label] / classified * 100, 2)
            else:
                percentage = None
            sentiment[label] = {
                "count": counts[label],
                "percentage": percentage,
            }
        return {
            "published_review_count": counts["published_review_count"],
            "classified_review_count": classified,
            "unclassified_review_count": counts["published_review_count"] - classified,
            "sentiment": sentiment,
        }

    @classmethod
    def get_report(
        cls,
        period,
        interval="daily",
    ):
        """Report current moderation inventory and period cohorts still published at query time."""
        retained = Review.objects.filter(REVW_CREATED_AT__lte=period.generated_at)
        inventory = retained.aggregate(
            retained_reviews=Count("pk"),
            **{
                status: Count("pk", filter=Q(REVW_STATUS=status))
                for status in Review.ReviewStatus.values
            },
        )
        published = retained.filter(REVW_STATUS=Review.ReviewStatus.PUBLISHED)
        expressions = {}
        for prefix, start, end in (
            ("current", period.start, period.end),
            ("previous", period.previous_start, period.previous_end),
        ):
            window = Q(REVW_CREATED_AT__gte=start, REVW_CREATED_AT__lt=end)
            expressions[f"{prefix}_published_review_count"] = Count("pk", filter=window)
            for label in cls.LABELS:
                expressions[f"{prefix}_{label}"] = Count(
                    "pk",
                    filter=window & Q(REVW_SENTIMENT_LABEL=label),
                )
        counts = published.filter(
            REVW_CREATED_AT__gte=period.previous_start,
            REVW_CREATED_AT__lt=period.end,
        ).aggregate(**expressions)
        cohorts = {}
        for prefix in ("current", "previous"):
            cohorts[prefix] = cls.measures({
                key: counts[f"{prefix}_{key}"]
                for key in cls.count_expressions()
            })
        rows = grouped_time_counts(
            published,
            "REVW_CREATED_AT",
            period,
            interval,
            **cls.count_expressions(),
        )
        buckets = {
            row["bucket"].date().isoformat(): cls.measures(row)
            for row in rows
        }
        empty = cls.measures({
            key: 0
            for key in cls.count_expressions()
        })
        return {
            "inventory": {
                "measurement_type": "current_snapshot",
                "selected_period_applies": False,
                "as_of": period.generated_at.isoformat(),
                **inventory,
            },
            "measurement_type": "period_current_state",
            **cohorts,
            "published_review_count_change": compare_count_difference(
                current=cohorts["current"]["published_review_count"],
                previous=cohorts["previous"]["published_review_count"],
                data_available=equal_elapsed_periods(period),
            ),
            "interval": interval,
            "series": [
                {**bucket, **buckets.get(bucket["date"], empty)}
                for bucket in calendar_buckets(period, interval)
            ],
            "series_is_sparse": False,
            "definition": (
                "Creation cohorts of retained reviews currently published, across all businesses. "
                "Current statuses and stored labels can revise history; this is not publication "
                "transition history. Sentiment uses recognized stored labels, matching Merchant "
                "Analytics, regardless of score availability. Unclassified includes null or "
                "unrecognized labels. Shares use pooled classified reviews only; no ratings "
                "or sentiment conclusions are inferred."
            ),
            "meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=("current_publication_and_sentiment_state", "retained_reviews_only"),
            ),
        }
