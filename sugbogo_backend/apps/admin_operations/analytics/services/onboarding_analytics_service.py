"""Compose unchanged onboarding statistics with additive operational aggregates."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count
from django.db.models.functions import TruncWeek
from django.utils import timezone

from apps.admin_operations.analytics.services.merchant_application_analytics_service import (
    MerchantApplicationAnalyticsService,
)
from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)
from apps.merchant_application.models import (
    MerchantApplication, MerchantApplicationReview, MerchantApplicationSubmission,
)
from apps.merchant_application.utils.application_queue import count_business_days
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta


class OnboardingAnalyticsService:
    """Keep legacy KPI semantics separate from selectable Manila event series."""

    @staticmethod
    def pending_aging(now):
        """Count submitted applications using the existing weekday SLA thresholds."""
        buckets = {"on_time": 0, "approaching": 0, "overdue": 0, "unknown_age": 0}
        reporting_zone = ZoneInfo(settings.TIME_ZONE)
        pending = MerchantApplication.objects.filter(
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        ).values_list("MAPP_SUBMITTED_AT", flat=True)
        for submitted_at in pending.iterator():
            if submitted_at is None or submitted_at > now:
                buckets["unknown_age"] += 1
                continue
            # Approved legacy exception: weekday aging retains configured UTC dates.
            age = count_business_days(
                submitted_at.astimezone(reporting_zone), now.astimezone(reporting_zone),
            )
            if age >= APPLICATION_REVIEW_SLA_BUSINESS_DAYS:
                buckets["overdue"] += 1
            elif age >= APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS:
                buckets["approaching"] += 1
            else:
                buckets["on_time"] += 1
        return buckets

    @staticmethod
    def weekly_activity(period):
        """Count submission and decision events in clipped, zero-filled Manila weeks."""
        sources = (
            ("submissions", MerchantApplicationSubmission.objects.all(), "MASUB_SUBMITTED_AT"),
            (
                "completed_reviews", MerchantApplicationReview.objects.filter(
                    MAREV_DECISION__in=MerchantApplicationReview.Decision.values,
                ), "MAREV_REVIEWED_AT",
            ),
        )
        counts = {}
        for name, queryset, field in sources:
            rows = queryset.filter(**{
                f"{field}__gte": period.start, f"{field}__lt": period.end,
            }).annotate(week=TruncWeek(field, tzinfo=MANILA)).values("week").annotate(
                value=Count("pk"),
            ).order_by("week")
            counts[name] = {row["week"].date(): row["value"] for row in rows}
        first = period.start.astimezone(MANILA)
        week = first.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=first.weekday())
        series = []
        while week < period.end:
            next_week = week + timedelta(days=7)
            series.append({
                "date": week.date().isoformat(),
                "start": max(week, period.start).isoformat(),
                "end_exclusive": min(next_week, period.end).isoformat(),
                **{name: values.get(week.date(), 0) for name, values in counts.items()},
            })
            week = next_week
        return series

    @staticmethod
    def get_report(period):
        """Expose native legacy statistics alongside separately scoped operational data."""
        # Approved exception: do not rewrite the existing UTC windows or trends.
        with timezone.override(settings.TIME_ZONE):
            statistics = MerchantApplicationAnalyticsService.get_application_statistics()
            legacy_windows = MerchantApplicationAnalyticsService.get_weekly_analytics_periods()
        return {
            "legacy_statistics": statistics,
            "legacy_meta": {
                "timezone": settings.TIME_ZONE,
                "as_of": period.generated_at.isoformat(),
                "selected_period_applies": False,
                "weekly_window": {key: value.isoformat() for key, value in legacy_windows.items()},
                "daily_history_days": 7,
                "definitions": "Unchanged existing onboarding statistics; snapshot/all-time KPIs and native trend windows.",
                "exception": "Approved legacy timezone and comparison-window exception; these outputs do not use the selected Manila period.",
            },
            "pending_aging": OnboardingAnalyticsService.pending_aging(period.generated_at),
            "aging_meta": {
                "measurement_type": "current_snapshot",
                "timezone": settings.TIME_ZONE,
                "as_of": period.generated_at.isoformat(),
                "approaching_business_days": APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
                "overdue_business_days": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
                "definition": "Weekdays elapsed excluding submission date; no holiday calendar. Selected period does not filter backlog.",
            },
            "weekly_activity": OnboardingAnalyticsService.weekly_activity(period),
            "weekly_activity_definition": "Submission events include resubmissions; completed review events include approved/rejected decisions, including unlinked legacy reviews.",
            "meta": build_meta(
                period, data_through=period.end, coverage_verified=True,
                partial_reasons=("legacy_onboarding_timezone_and_window_exception",),
            ),
        }
