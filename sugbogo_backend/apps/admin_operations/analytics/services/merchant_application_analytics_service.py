from datetime import datetime, time, timedelta

from django.conf import settings
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

from apps.shared.analytics.policy import current_policy, with_policy_snapshot
from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
    REVIEWABLE_APPLICATION_STATUSES,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)


class MerchantApplicationAnalyticsService:
    """Provides analytics and metrics for merchant applications."""

    @staticmethod
    @with_policy_snapshot
    def get_application_statistics(now=None):
        """Retrieve aggregate merchant application statistics."""

        if now is None:
            reference_time = timezone.now()
        else:
            reference_time = now
        comparison_periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_comparison_periods(reference_time)
        )
        statistics = MerchantApplication.objects.aggregate(
            pending_review=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
                ),
            ),
            approved=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
                ),
            ),
            rejected=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
                ),
            ),
            total_applications=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS__in=REVIEWABLE_APPLICATION_STATUSES,
                ),
            ),
        )

        return {
            **statistics,
            "comparison_meta": {
                "timezone": settings.TIME_ZONE,
                "strategy": "equal_elapsed_week_to_date",
                "bounds": {
                    key: value.isoformat()
                    for key, value in comparison_periods.items()
                },
                "resubmission_basis": "cumulative_as_of_comparison_end",
                "resubmission_definition": (
                    "Applications with a recorded rejection before the cutoff that "
                    "have a submission strictly after a rejection and before the cutoff, "
                    "divided by applications rejected before the cutoff. "
                    "Each application counts once, including later-approved applications."
                ),
            },
            "policy_version": current_policy().version,
            "comparison_minimum_sample": current_policy()["onboarding_comparison_min_sample"],
            "approval_rate": (
                MerchantApplicationAnalyticsService
                .get_approval_rate()
            ),
            "resubmission_rate": (
                MerchantApplicationAnalyticsService
                .get_resubmission_rate(reference_time)
            ),
            "sla_compliance_rate": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate()
            ),
            "approval_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_approval_rate_trend(reference_time)
            ),
            "resubmission_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_resubmission_rate_trend(reference_time)
            ),
            "pending_review_this_week": (
                MerchantApplicationAnalyticsService
                .get_pending_review_this_week()
            ),
            "sla_compliance_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate_trend(reference_time)
            ),
            "pending_review_history": (
                MerchantApplicationAnalyticsService
                .get_pending_review_history()
            ),
            "approval_rate_history": (
                MerchantApplicationAnalyticsService
                .get_approval_rate_history()
            ),
            "resubmission_rate_history": (
                MerchantApplicationAnalyticsService
                .get_resubmission_rate_history(reference_time)
            ),
            "sla_compliance_rate_history": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate_history()
            ),
            "review_sla_business_days": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
            "review_sla_approaching_business_days": (
                APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS
            ),
        }

    @staticmethod
    def get_weekly_analytics_periods(now=None):
        """
        Return legacy inclusive calendar labels for workload counts and metadata.

        Trend queries use get_weekly_comparison_periods() instead, so these
        date-only labels cannot include a complete prior day in a live comparison.
        """

        if now is None:
            today = timezone.localdate()
        else:
            today = timezone.localtime(
                now,
                timezone.get_default_timezone(),
            ).date()
        current_week_start = today - timedelta(days=today.weekday())

        elapsed_days = (today - current_week_start).days

        previous_week_start = current_week_start - timedelta(days=7)
        previous_week_end = previous_week_start + timedelta(days=elapsed_days)

        return {
            "current_start": current_week_start,
            "current_end": today,
            "previous_start": previous_week_start,
            "previous_end": previous_week_end,
        }

    @staticmethod
    def get_weekly_comparison_periods(now=None):
        """Retain the configured timezone and compare half-open weeks of equal elapsed time."""
        if now is None:
            reference_time = timezone.now()
        else:
            reference_time = now
        local_now = timezone.localtime(
            reference_time,
            timezone.get_default_timezone(),
        )
        monday = local_now.date() - timedelta(days=local_now.weekday())
        current_start = datetime.combine(
            monday,
            time.min,
            tzinfo=timezone.get_default_timezone(),
        )
        return {
            "current_start": current_start,
            "current_end_exclusive": local_now,
            "previous_start": current_start - timedelta(days=7),
            "previous_end_exclusive": local_now - timedelta(days=7),
        }

    @staticmethod
    def get_daily_analytics_periods(
        days=7,
        now=None,
    ):
        """
        Return the daily periods used for KPI sparkline history.

        The returned periods cover the most recent `days` calendar days,
        including today.
        """

        if now is None:
            today = timezone.localdate()
        else:
            today = timezone.localtime(
                now,
                timezone.get_default_timezone(),
            ).date()

        return [
            today - timedelta(days=offset)
            for offset in range(days - 1, -1, -1)
        ]

    @staticmethod
    def calculate_trend(
        current_value,
        previous_value,
        current_sample_size,
        previous_sample_size,
        minimum_sample_size=None,
        unit="count",
    ):
        """
        Calculate a trend between two periods.

        Returns no trend when either period does not have enough observations.
        Rate-based trends are expressed in percentage points.
        """

        # The versioned policy controls comparison sample eligibility.
        if minimum_sample_size is None:
            minimum_sample_size = current_policy()["onboarding_comparison_min_sample"]
        if (
            current_sample_size < minimum_sample_size
            or previous_sample_size < minimum_sample_size
        ):
            return None

        if unit == "percentage_points":
            change = round(current_value - previous_value, 1)
        else:
            change = current_value - previous_value

        if change > 0:
            direction = "up"
        elif change < 0:
            direction = "down"
        else:
            direction = "unchanged"

        return {
            "value": abs(change),
            "direction": direction,
            "unit": unit,
        }

    @staticmethod
    def get_sla_outcomes(reviews):
        """Calculate classified compliance while retaining unknown outcomes separately."""
        outcomes = reviews.aggregate(
            compliant=Count(
                "MAREV_ID",
                filter=Q(MAREV_SLA_COMPLIANT=True),
            ),
            non_compliant=Count(
                "MAREV_ID",
                filter=Q(MAREV_SLA_COMPLIANT=False),
            ),
            unknown=Count(
                "MAREV_ID",
                filter=Q(MAREV_SLA_COMPLIANT__isnull=True),
            ),
        )
        classified = outcomes["compliant"] + outcomes["non_compliant"]
        if classified:
            rate = round(outcomes["compliant"] / classified * 100, 1)
        else:
            rate = None
        return {
            **outcomes,
            "classified": classified,
            "rate": rate,
        }

    @staticmethod
    def get_sla_compliance_rate():
        """Return compliant / classified persisted outcomes, excluding unknown SLA results."""
        outcomes = MerchantApplicationAnalyticsService.get_sla_outcomes(
            MerchantApplicationReview.objects.all(),
        )
        return outcomes["rate"]

    @staticmethod
    def get_sla_compliance_rate_trend(now=None):
        """
        Calculate the weekly SLA-compliance-rate trend.

        Each completed review event is evaluated independently against
        the submission it reviewed. Resubmissions therefore produce
        separate review events.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_comparison_periods(now)
        )

        def get_period_rate(
            start,
            end,
        ):
            """Use known outcomes as both the rate denominator and comparison sample."""
            reviews = MerchantApplicationReview.objects.filter(
                MASUB_ID__isnull=False,
                MAREV_REVIEWED_AT__gte=start,
                MAREV_REVIEWED_AT__lt=end,
            )
            outcomes = MerchantApplicationAnalyticsService.get_sla_outcomes(
                reviews,
            )
            return outcomes["rate"], outcomes["classified"]

        current_rate, current_sample = get_period_rate(
            periods["current_start"],
            periods["current_end_exclusive"],
        )

        previous_rate, previous_sample = get_period_rate(
            periods["previous_start"],
            periods["previous_end_exclusive"],
        )

        if current_rate is None or previous_rate is None:
            return None

        return MerchantApplicationAnalyticsService.calculate_trend(
            current_value=current_rate,
            previous_value=previous_rate,
            current_sample_size=current_sample,
            previous_sample_size=previous_sample,
            unit="percentage_points",
        )

    
    @staticmethod
    def get_approval_rate():
        """
        Calculate the percentage of decided applications that are approved.

        Each merchant application is counted once based on its current
        final status. Draft and submitted applications are excluded.
        """

        statistics = MerchantApplication.objects.aggregate(
            approved=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
                ),
            ),
            rejected=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
                ),
            ),
        )

        decided_applications = (
            statistics["approved"] + statistics["rejected"]
        )

        if decided_applications == 0:
            return None

        return round(
            (statistics["approved"] / decided_applications) * 100,
            1,
        )
    

    @staticmethod
    def get_post_rejection_submissions(as_of):
        """Select submission events strictly after a rejection of the same application."""
        preceding_rejection = MerchantApplicationReview.objects.filter(
            MAPP_ID=OuterRef("MAPP_ID"),
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT__lt=OuterRef("MASUB_SUBMITTED_AT"),
        )
        return MerchantApplicationSubmission.objects.filter(
            MASUB_SUBMITTED_AT__lt=as_of,
        ).filter(
            Exists(preceding_rejection),
        )

    @staticmethod
    def get_resubmission_counts(as_of):
        """Count rejected applications and those recovered by the same exclusive cutoff."""
        rejections = MerchantApplicationReview.objects.filter(
            MAPP_ID=OuterRef("pk"),
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT__lt=as_of,
        )
        resubmissions = (
            MerchantApplicationAnalyticsService
            .get_post_rejection_submissions(as_of)
            .filter(MAPP_ID=OuterRef("pk"))
        )
        applications = MerchantApplication.objects.annotate(
            has_rejection=Exists(rejections),
            has_resubmission=Exists(resubmissions),
        ).filter(
            has_rejection=True,
        )
        return applications.aggregate(
            eligible=Count("MAPP_ID"),
            resubmitted=Count(
                "MAPP_ID",
                filter=Q(has_resubmission=True),
            ),
        )

    @staticmethod
    def get_resubmission_rate(as_of=None):
        """Return the cumulative share of rejected applications subsequently resubmitted."""
        if as_of is None:
            cutoff = timezone.now()
        else:
            cutoff = as_of
        counts = MerchantApplicationAnalyticsService.get_resubmission_counts(
            cutoff,
        )
        if counts["eligible"] == 0:
            return None
        return round(counts["resubmitted"] / counts["eligible"] * 100, 1)

    @staticmethod
    def get_resubmission_rate_trend(now=None):
        """Compare cumulative rejection-recovery rates now and at the same time last week."""
        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_comparison_periods(now)
        )
        current = MerchantApplicationAnalyticsService.get_resubmission_counts(
            periods["current_end_exclusive"],
        )
        previous = MerchantApplicationAnalyticsService.get_resubmission_counts(
            periods["previous_end_exclusive"],
        )
        if (
            not current["eligible"]
            or not previous["eligible"]
        ):
            return None
        return MerchantApplicationAnalyticsService.calculate_trend(
            current_value=round(
                current["resubmitted"] / current["eligible"] * 100,
                1,
            ),
            previous_value=round(
                previous["resubmitted"] / previous["eligible"] * 100,
                1,
            ),
            current_sample_size=current["eligible"],
            previous_sample_size=previous["eligible"],
            unit="percentage_points",
        )

    @staticmethod
    def get_approval_rate_trend(now=None):
        """
        Calculate the weekly approval-rate trend.

        Each application is counted once per period using its latest
        review within that period. This prevents resubmitted applications
        from being counted multiple times.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_comparison_periods(now)
        )

        # Helper function to calculate the approval rate for a given period
        def get_period_rate(
            start,
            end,
        ):
            """Count the latest application decision inside one half-open time window."""
            reviews = list(
                MerchantApplicationReview.objects
                .filter(
                    MAREV_REVIEWED_AT__gte=start,
                    MAREV_REVIEWED_AT__lt=end,
                    MAREV_DECISION__in=[
                        MerchantApplicationReview.Decision.APPROVED,
                        MerchantApplicationReview.Decision.REJECTED,
                    ],
                )
                .order_by(
                    "MAPP_ID",
                    "-MAREV_REVIEWED_AT",
                    "-MAREV_ID",
                )
                .distinct("MAPP_ID")
            )

            approved = sum(
                review.MAREV_DECISION
                == MerchantApplicationReview.Decision.APPROVED
                for review in reviews
            )

            rejected = sum(
                review.MAREV_DECISION
                == MerchantApplicationReview.Decision.REJECTED
                for review in reviews
            )

            total = approved + rejected

            if total == 0:
                return None, 0

            return (
                round((approved / total) * 100, 1),
                total,
            )

        current_rate, current_sample = get_period_rate(
            periods["current_start"],
            periods["current_end_exclusive"],
        )

        previous_rate, previous_sample = get_period_rate(
            periods["previous_start"],
            periods["previous_end_exclusive"],
        )

        if current_rate is None or previous_rate is None:
            return None

        return MerchantApplicationAnalyticsService.calculate_trend(
            current_value=current_rate,
            previous_value=previous_rate,
            current_sample_size=current_sample,
            previous_sample_size=previous_sample,
            unit="percentage_points",
        )
    

    @staticmethod
    def get_pending_review_this_week():
        """
        Return the number of application submissions that entered the
        administrator review queue during the current week.

        Each submission is counted independently, so resubmissions are
        included as separate review events.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        return MerchantApplicationSubmission.objects.filter(
            MASUB_SUBMITTED_AT__date__gte=periods["current_start"],
            MASUB_SUBMITTED_AT__date__lte=periods["current_end"],
        ).count()


    @staticmethod
    def get_approval_rate_history():
        """
        Return daily approval-rate values for the KPI sparkline.

        Each application is counted once per day using its latest review
        for that day.
        """

        dates = (
            MerchantApplicationAnalyticsService
            .get_daily_analytics_periods()
        )

        history = []

        for date in dates:
            reviews = list(
                MerchantApplicationReview.objects
                .filter(
                    MAREV_REVIEWED_AT__date=date,
                    MAREV_DECISION__in=[
                        MerchantApplicationReview.Decision.APPROVED,
                        MerchantApplicationReview.Decision.REJECTED,
                    ],
                )
                .order_by(
                    "MAPP_ID",
                    "-MAREV_REVIEWED_AT",
                    "-MAREV_ID",
                )
                .distinct("MAPP_ID")
            )

            total = len(reviews)

            if total == 0:
                value = None
            else:
                approved = sum(
                    review.MAREV_DECISION
                    == MerchantApplicationReview.Decision.APPROVED
                    for review in reviews
                )

                value = round((approved / total) * 100, 1)

            history.append({
                "date": date.isoformat(),
                "value": value,
            })

        return history


    @staticmethod
    def get_resubmission_rate_history(now=None):
        """Apply the headline recovery definition at each day-end, capping today at now."""
        if now is None:
            reference_time = timezone.now()
        else:
            reference_time = now
        dates = MerchantApplicationAnalyticsService.get_daily_analytics_periods(
            now=reference_time,
        )
        history = []
        for date in dates:
            next_midnight = datetime.combine(
                date + timedelta(days=1),
                time.min,
                tzinfo=timezone.get_default_timezone(),
            )
            cutoff = min(next_midnight, reference_time)
            value = MerchantApplicationAnalyticsService.get_resubmission_rate(
                cutoff,
            )
            history.append({
                "date": date.isoformat(),
                "value": value,
            })
        return history

    @staticmethod
    def get_sla_compliance_rate_history():
        """
        Return daily SLA-compliance-rate values for the KPI sparkline.

        Each completed review event is evaluated independently using its
        persisted SLA-compliance result.
        """

        dates = (
            MerchantApplicationAnalyticsService
            .get_daily_analytics_periods()
        )

        history = []

        reviews = list(
            MerchantApplicationReview.objects
            .select_related("MASUB_ID")
            .filter(
                MASUB_ID__isnull=False,
                MAREV_SLA_COMPLIANT__isnull=False,
                MAREV_REVIEWED_AT__date__gte=dates[0],
                MAREV_REVIEWED_AT__date__lte=dates[-1],
            )
        )

        reviews_by_date = {}

        for review in reviews:
            review_date = review.MAREV_REVIEWED_AT.date()

            reviews_by_date.setdefault(
                review_date,
                [],
            ).append(review.MAREV_SLA_COMPLIANT)

        for date in dates:
            date_results = reviews_by_date.get(date, [])

            if not date_results:
                value = None
            else:
                compliant_reviews = sum(date_results)

                value = round(
                    (compliant_reviews / len(date_results)) * 100,
                    1,
                )

            history.append({
                "date": date.isoformat(),
                "value": value,
            })

        return history


    @staticmethod
    def get_pending_review_history():
        """
        Return daily pending-review counts for the KPI sparkline.

        A submission is pending at a historical cutoff when it was submitted
        on or before that date and had not received a review by that date.
        """

        dates = (
            MerchantApplicationAnalyticsService
            .get_daily_analytics_periods()
        )

        history = []

        for date in dates:
            reviewed_submission_ids = (
                MerchantApplicationReview.objects
                .filter(
                    MASUB_ID=OuterRef("pk"),
                    MAREV_REVIEWED_AT__date__lte=date,
                )
                .values("MAREV_ID")
            )

            pending_count = (
                MerchantApplicationSubmission.objects
                .filter(
                    MASUB_SUBMITTED_AT__date__lte=date,
                )
                .annotate(
                    was_reviewed=Exists(reviewed_submission_ids),
                )
                .filter(
                    was_reviewed=False,
                )
                .count()
            )

            history.append({
                "date": date.isoformat(),
                "value": pending_count,
            })

        return history
