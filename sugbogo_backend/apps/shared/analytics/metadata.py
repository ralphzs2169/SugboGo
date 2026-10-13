"""Describe analytics freshness and known coverage limitations."""

from datetime import UTC

from django.utils import timezone


def build_meta(
    period, *, availability="available", data_through=None,
    coverage_verified=False, partial_reasons=(),
):
    """Build metadata for data.meta without modifying the core response envelope."""
    if availability not in {"available", "partial", "unavailable"}:
        raise ValueError("Unsupported availability status.")
    reasons = list(dict.fromkeys(partial_reasons))
    if availability == "partial":
        reasons.append("source_partial")
    if period.includes_partial_day:
        reasons.append("current_day_incomplete")
    # First-observed activity is not evidence of complete historical tracking.
    if not coverage_verified:
        reasons.append("coverage_unverified")
    if availability == "unavailable":
        data_through = None
        reasons.append("source_unavailable")
    elif data_through is None:
        reasons.append("freshness_unverified")
    else:
        if timezone.is_naive(data_through):
            raise ValueError("Data-through must be an aware datetime.")
        data_through = data_through.astimezone(UTC)
        if not period.start <= data_through <= period.end:
            raise ValueError("Data-through must fall within the effective period.")
        if data_through < period.end:
            reasons.append("data_lag")
    reasons = list(dict.fromkeys(reasons))
    status = "partial" if availability == "available" and reasons else availability
    return {
        "period": {
            "timezone": "Asia/Manila",
            "start_date": period.start_date.isoformat(),
            "end_date": period.end_date.isoformat(),
            "start": period.start.isoformat(),
            "end_exclusive": period.end.isoformat(),
            "previous_start": period.previous_start.isoformat(),
            "previous_end_exclusive": period.previous_end.isoformat(),
        },
        "data_through": data_through.isoformat() if data_through is not None else None,
        "generated_at": period.generated_at.isoformat(),
        "availability": status,
        "is_partial": status != "available" or bool(reasons),
        "partial_reason": reasons[0] if reasons else None,
        "partial_reasons": reasons,
        "coverage_verified": coverage_verified,
    }
