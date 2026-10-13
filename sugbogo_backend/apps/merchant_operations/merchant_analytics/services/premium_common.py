"""Shared owned-business Premium report boundaries and SQL snapshot metadata."""

from dataclasses import replace
from datetime import timedelta

from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta


def previous_period(period):
    """Select the immediately adjacent prior window with exactly the same elapsed duration."""
    duration = period.end - period.start
    return replace(
        period,
        start_date=period.previous_start.astimezone(MANILA).date(),
        end_date=(period.previous_end - timedelta(microseconds=1)).astimezone(MANILA).date(),
        start=period.previous_start,
        end=period.previous_end,
        previous_start=period.previous_start - duration,
        previous_end=period.previous_start,
        includes_partial_day=False,
    )


def owned_business_data(business):
    """Expose only the caller's business identity and current status."""
    return {"id": business.pk, "name": business.BUSN_NAME, "status": business.BUSN_STATUS}


def snapshot_meta(period, *reasons):
    """Describe complete SQL reads while disclosing retained current-state reporting."""
    return build_meta(
        period, coverage_verified=True, data_through=period.end,
        partial_reasons=("current_state_reporting", *reasons),
    )


def week_buckets(period):
    """Yield clipped Monday-week buckets using Manila reporting boundaries."""
    start = period.start.astimezone(MANILA)
    bucket = start.replace(hour=0, minute=0, second=0, microsecond=0)
    bucket -= timedelta(days=bucket.weekday())
    end = period.end.astimezone(MANILA)
    while bucket < end:
        following = bucket + timedelta(days=7)
        yield {
            "date": bucket.date().isoformat(),
            "start": max(bucket, start).isoformat(),
            "end_exclusive": min(following, end).isoformat(),
        }
        bucket = following
