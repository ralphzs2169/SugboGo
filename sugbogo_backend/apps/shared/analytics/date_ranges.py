"""Resolve Manila reporting dates without changing storage or deduplication."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.exceptions import ValidationError


MANILA = ZoneInfo("Asia/Manila")


@dataclass(frozen=True)
class AnalyticsPeriod:
    """Hold UTC query bounds and the requested Manila calendar dates."""

    start_date: date
    end_date: date
    start: datetime
    end: datetime
    previous_start: datetime
    previous_end: datetime
    generated_at: datetime
    includes_partial_day: bool


def _parse_date(value, field):
    """Parse an ISO calendar date with a controlled validation error."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            parsed = date.fromisoformat(value)
            if parsed.isoformat() == value:
                return parsed
        except ValueError:
            pass
    raise ValidationError({field: "Use a valid ISO calendar date (YYYY-MM-DD)."})


def resolve_period(*, preset="30", start_date=None, end_date=None, now=None):
    """Resolve an inclusive date selection into half-open UTC query periods."""
    captured_now = now if now is not None else timezone.now()
    if not isinstance(captured_now, datetime) or timezone.is_naive(captured_now):
        raise ValidationError({"now": "An aware datetime is required."})
    captured_now = captured_now.astimezone(UTC)
    today = captured_now.astimezone(MANILA).date()
    preset = str(preset)
    if preset == "custom":
        first = _parse_date(start_date, "start_date")
        last = _parse_date(end_date, "end_date")
    elif preset in {"7", "30", "90"}:
        if start_date is not None or end_date is not None:
            raise ValidationError({"preset": "Use custom when providing dates."})
        last = today
        first = today - timedelta(days=int(preset) - 1)
    else:
        raise ValidationError({"preset": "Choose 7, 30, 90, or custom."})
    if first > last or last > today:
        raise ValidationError({"period": "Dates must be ordered and not in the future."})
    start = datetime.combine(first, time.min, tzinfo=MANILA).astimezone(UTC)
    requested_end = datetime.combine(
        last + timedelta(days=1), time.min, tzinfo=MANILA,
    ).astimezone(UTC)
    end = min(requested_end, captured_now)
    if end <= start:
        raise ValidationError({"period": "The selected period has no elapsed time."})
    return AnalyticsPeriod(
        start_date=first,
        end_date=last,
        start=start,
        end=end,
        previous_start=start - (end - start),
        previous_end=start,
        generated_at=captured_now,
        includes_partial_day=end < requested_end,
    )
