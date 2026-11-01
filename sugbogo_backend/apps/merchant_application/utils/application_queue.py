from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)
from apps.merchant_application.models import MerchantApplication


MANILA = ZoneInfo("Asia/Manila")


def count_business_days(
    start,
    end,
):
    """
    Count weekdays elapsed between two dates.

    The start date is excluded, so an application submitted today
    has spent 0 business days in the queue.
    """

    if not start or not end:
        return None

    if isinstance(start, datetime):
        if timezone.is_aware(start):
            start = start.astimezone(MANILA)
        start = start.date()

    if isinstance(end, datetime):
        if timezone.is_aware(end):
            end = end.astimezone(MANILA)
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


def get_business_day_cutoff(
    days,
    reference_time=None,
):
    """Return the latest submission date with at least `days` elapsed weekdays."""
    if reference_time is None:
        reference_time = timezone.now()

    current_date = timezone.localdate(
        reference_time,
        timezone=MANILA,
    )
    remaining_days = days

    while remaining_days > 0:
        # Count the end date and exclude the eventual submission date.
        if current_date.weekday() < 5:
            remaining_days -= 1

        current_date -= timedelta(days=1)

    return current_date


def get_application_queue_aging_filters(reference_time=None):
    """Share mutually exclusive current application aging predicates with queue consumers."""
    if reference_time is None:
        reference_time = timezone.now()

    approaching_cutoff = get_business_day_cutoff(
        APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
        reference_time=reference_time,
    )
    overdue_cutoff = get_business_day_cutoff(
        APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
        reference_time=reference_time,
    )
    # Half-open Manila midnight bounds match local date extraction while
    # leaving the timestamp column available for ordinary database indexes.
    approaching_end = datetime.combine(
        approaching_cutoff + timedelta(days=1),
        time.min,
        tzinfo=MANILA,
    )
    overdue_end = datetime.combine(
        overdue_cutoff + timedelta(days=1),
        time.min,
        tzinfo=MANILA,
    )
    pending = Q(
        MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        MAPP_SUBMITTED_AT__lte=reference_time,
        MAPP_REVIEWED_AT__isnull=True,
    )

    return {
        "on_time": pending & Q(
            MAPP_SUBMITTED_AT__gte=approaching_end,
        ),
        "approaching": pending & Q(
            MAPP_SUBMITTED_AT__gte=overdue_end,
            MAPP_SUBMITTED_AT__lt=approaching_end,
        ),
        "overdue": pending & Q(
            MAPP_SUBMITTED_AT__lt=overdue_end,
        ),
    }


def get_application_queue_status(
    submitted_at,
    resolved_at=None,
):
    """
    Determine the application's review queue state relative to
    the configured business-day review target.
    """

    if not submitted_at:
        return None

    end = resolved_at or timezone.now()

    if submitted_at > end:
        return None

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
