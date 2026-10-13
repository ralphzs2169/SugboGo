"""Compare counts and rates with explicit evidence requirements."""

from math import isfinite


def _unavailable(reason, unit):
    """Return a comparison absence without inventing a zero change."""
    return {"value": None, "direction": None, "unit": unit, "reason": reason}


def compare_values(
    *, current, previous, current_sample_size, previous_sample_size,
    minimum_sample_size=1, unit="percent", current_denominator=None,
    previous_denominator=None, data_available=True,
):
    """Return a signed change or an explicit reason why it cannot be computed."""
    if unit not in {"percent", "percentage_points"}:
        raise ValueError("Unsupported comparison unit.")
    if minimum_sample_size < 1:
        raise ValueError("Minimum sample size must be positive.")
    if not data_available:
        return _unavailable("data_unavailable", unit)
    if current is None or previous is None:
        return _unavailable("missing_value", unit)
    if not isfinite(current) or not isfinite(previous):
        raise ValueError("Comparison values must be finite.")
    if unit == "percentage_points":
        if (
            current_denominator is None or previous_denominator is None
            or current_denominator <= 0 or previous_denominator <= 0
        ):
            return _unavailable("missing_or_zero_denominator", unit)
        if not 0 <= current <= 100 or not 0 <= previous <= 100:
            raise ValueError("Rates must be expressed on the 0-100 scale.")
    elif current < 0 or previous < 0:
        raise ValueError("Count values must not be negative.")
    elif previous == 0:
        return _unavailable("zero_previous_value", unit)
    if (
        current_sample_size is None or previous_sample_size is None
        or current_sample_size < minimum_sample_size
        or previous_sample_size < minimum_sample_size
    ):
        return _unavailable("insufficient_sample", unit)
    change = current - previous
    if unit == "percent":
        change = change / previous * 100
    value = round(float(change), 2)
    return {
        "value": value,
        "direction": "up" if value > 0 else "down" if value < 0 else "unchanged",
        "unit": unit,
        "reason": None,
    }
