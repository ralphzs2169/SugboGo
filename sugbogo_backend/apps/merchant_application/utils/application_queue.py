from datetime import datetime, timedelta

from django.utils import timezone

from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)


def count_business_days(start, end):
    """
    Count weekdays elapsed between two dates.

    The start date is excluded, so an application submitted today
    has spent 0 business days in the queue.
    """

    if not start or not end:
        return None

    if isinstance(start, datetime):
        start = start.date()

    if isinstance(end, datetime):
        end = end.date()

    if end <= start:
        return 0

    business_days = 0
    current_date = start + timedelta(days=1)

    while current_date <= end:
        if current_date.weekday() < 5:
            business_days += 1

        current_date += timedelta(days=1)

    return business_days


def get_business_day_cutoff(days):
    """
    Return the calendar date that is `days` business days before today.
    """

    current_date = timezone.localdate()
    remaining_days = days

    while remaining_days > 0:
        current_date -= timedelta(days=1)

        if current_date.weekday() < 5:
            remaining_days -= 1

    return current_date


def get_application_queue_status(submitted_at, resolved_at=None):
    """
    Determine the application's review queue state relative to
    the configured business-day review target.
    """

    if not submitted_at:
        return None

    end = resolved_at or timezone.now()

    business_days = count_business_days(
        submitted_at,
        end,
    )

    if resolved_at:
        return "resolved"

    if business_days >= APPLICATION_REVIEW_SLA_BUSINESS_DAYS:
        return "overdue"

    if business_days >= APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS:
        return "approaching"

    return "on_time"


def is_review_sla_compliant(submission, reviewed_at):
    """Determine whether a review met the configured application SLA."""

    business_days = count_business_days(
        submission.MASUB_SUBMITTED_AT,
        reviewed_at,
    )

    return business_days < APPLICATION_REVIEW_SLA_BUSINESS_DAYS