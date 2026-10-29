"""Shared SQL reporting buckets, count comparisons and timestamp-only duration summaries."""

from datetime import UTC, timedelta
from statistics import mean, median

from django.db.models import Count, Q
from django.db.models.functions import TruncDay, TruncWeek
from rest_framework.exceptions import ValidationError

from apps.shared.analytics.comparisons import compare_count_difference, equal_elapsed_periods
from apps.shared.analytics.date_ranges import MANILA


def calendar_buckets(
    period,
    interval,
):
    """Yield clipped Manila calendar buckets without querying once per bucket."""
    if interval not in ("daily", "weekly"):
        raise ValidationError({"interval": "Choose daily or weekly."})
    first = period.start.astimezone(MANILA)
    bucket = first.replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == "weekly":
        bucket -= timedelta(days=bucket.weekday())
        step = timedelta(days=7)
    else:
        step = timedelta(days=1)
    while bucket < period.end:
        following = bucket + step
        yield {
            "date": bucket.date().isoformat(),
            "start": max(bucket.astimezone(UTC), period.start).isoformat(),
            "end_exclusive": min(following.astimezone(UTC), period.end).isoformat(),
        }
        bucket = following


def grouped_time_counts(
    queryset,
    field,
    period,
    interval,
    **counts,
):
    """Group selected retained rows in SQL using the shared Manila bucket convention."""
    if interval == "daily":
        truncation = TruncDay
    elif interval == "weekly":
        truncation = TruncWeek
    else:
        raise ValidationError({"interval": "Choose daily or weekly."})
    if not counts:
        counts = {"value": Count("pk")}
    return (
        queryset.filter(**{
            f"{field}__gte": period.start,
            f"{field}__lt": period.end,
        })
        .order_by()
        .annotate(bucket=truncation(field, tzinfo=MANILA))
        .values("bucket")
        .annotate(**counts)
        .order_by("bucket")
    )


def period_count(
    queryset,
    field,
    period,
):
    """Count adjacent equal-elapsed periods without requiring a percentage denominator."""
    counts = queryset.filter(**{
        f"{field}__gte": period.previous_start,
        f"{field}__lt": period.end,
    }).aggregate(
        current=Count("pk", filter=Q(**{
            f"{field}__gte": period.start,
            f"{field}__lt": period.end,
        })),
        previous=Count("pk", filter=Q(**{
            f"{field}__gte": period.previous_start,
            f"{field}__lt": period.previous_end,
        })),
    )
    return {
        "value": counts["current"],
        "previous_value": counts["previous"],
        "change": compare_count_difference(
            current=counts["current"],
            previous=counts["previous"],
            data_available=equal_elapsed_periods(period),
        ),
    }


def summarize_turnaround(rows):
    """Summarize timestamp triples with exclusive missing, relation and chronology exclusions."""
    durations = []
    missing = 0
    invalid = 0
    unrelated = 0
    candidates = 0
    for submitted_at, decided_at, related in rows:
        candidates += 1
        if submitted_at is None or decided_at is None:
            missing += 1
        elif not related:
            unrelated += 1
        elif decided_at < submitted_at:
            invalid += 1
        else:
            durations.append((decided_at - submitted_at).total_seconds() / 3600)
    if durations:
        median_hours = round(median(durations), 2)
        mean_hours = round(mean(durations), 2)
    else:
        median_hours = None
        mean_hours = None
    return {
        "candidate_count": candidates,
        "sample_count": len(durations),
        "median_hours": median_hours,
        "mean_hours": mean_hours,
        "excluded_count": missing + invalid + unrelated,
        "missing_timestamp_count": missing,
        "invalid_chronology_count": invalid,
        "unrelated_record_count": unrelated,
    }
