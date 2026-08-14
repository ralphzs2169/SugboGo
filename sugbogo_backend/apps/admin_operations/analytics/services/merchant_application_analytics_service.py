from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

from apps.admin_operations.analytics.constants import (
    ANALYTICS_MINIMUM_TREND_SAMPLE_SIZE,
)
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
    def get_application_statistics():
        """Retrieve aggregate merchant application statistics."""

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
            "approval_rate": (
                MerchantApplicationAnalyticsService
                .get_approval_rate()
            ),
            "resubmission_rate": (
                MerchantApplicationAnalyticsService
                .get_resubmission_rate()
            ),
            "sla_compliance_rate": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate()
            ),
            "approval_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_approval_rate_trend()
            ),
            "resubmission_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_resubmission_rate_trend()
            ),
            "pending_review_this_week": (
                MerchantApplicationAnalyticsService
                .get_pending_review_this_week()
            ),
            "sla_compliance_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate_trend()
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
                .get_resubmission_rate_history()
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
    def get_weekly_analytics_periods():
        """
        Return the current weekly period and the equivalent previous-week
        period using the same number of elapsed days.

        The current period starts on Monday and ends on today's date.
        The previous period covers the same number of weekdays immediately
        preceding the current week.
        """

        today = timezone.localdate()
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
    def get_daily_analytics_periods(days=7):
        """
        Return the daily periods used for KPI sparkline history.

        The returned periods cover the most recent `days` calendar days,
        including today.
        """

        today = timezone.localdate()

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
        minimum_sample_size=ANALYTICS_MINIMUM_TREND_SAMPLE_SIZE,
        unit="count",
    ):
        """
        Calculate a trend between two periods.

        Returns no trend when either period does not have enough observations.
        Rate-based trends are expressed in percentage points.
        """

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
    def get_sla_compliance_rate():
        """
        Calculate the percentage of completed review events resolved
        within the configured application review SLA.

        Each completed review is measured against the specific submission
        it reviewed, so resubmissions are evaluated independently.
        """

        completed_reviews = MerchantApplicationReview.objects.filter(
            MAREV_SLA_COMPLIANT__isnull=False,
        )

        total_reviews = completed_reviews.count()

        if total_reviews == 0:
            return None

        compliant_reviews = completed_reviews.filter(
            MAREV_SLA_COMPLIANT=True,
        ).count()

        return round(
            (compliant_reviews / total_reviews) * 100,
            1,
        )
    
    @staticmethod
    def get_sla_compliance_rate_trend():
        """
        Calculate the weekly SLA-compliance-rate trend.

        Each completed review event is evaluated independently against
        the submission it reviewed. Resubmissions therefore produce
        separate review events.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        def get_period_rate(start, end):
            reviews = (
                MerchantApplicationReview.objects
                .filter(
                    MASUB_ID__isnull=False,
                    MAREV_REVIEWED_AT__date__gte=start,
                    MAREV_REVIEWED_AT__date__lte=end,
                )
            )

            total_reviews = reviews.count()

            if total_reviews == 0:
                return None, 0

            compliant_reviews = reviews.filter(
                MAREV_SLA_COMPLIANT=True,
            ).count()

            return (
                round(
                    (compliant_reviews / total_reviews) * 100,
                    1,
                ),
                total_reviews,
            )

        current_rate, current_sample = get_period_rate(
            periods["current_start"],
            periods["current_end"],
        )

        previous_rate, previous_sample = get_period_rate(
            periods["previous_start"],
            periods["previous_end"],
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
    def get_resubmission_rate():
        """
        Calculate the percentage of rejected applications that have been
        resubmitted.

        Each application is counted once regardless of how many times it
        was resubmitted.

        The denominator contains applications that have been rejected.
        Draft, submitted-only, and approved applications are excluded.
        """

        rejected_applications = (
            MerchantApplication.objects
            .filter(
                reviews__MAREV_DECISION=(
                    MerchantApplicationReview.Decision.REJECTED
                ),
            )
            .distinct()
        )

        total_rejected = rejected_applications.count()

        if total_rejected == 0:
            return None

        resubmitted = rejected_applications.filter(
            MAPP_SUBMISSION_COUNT__gte=2,
        ).count()

        return round(
            (resubmitted / total_rejected) * 100,
            1,
        )

    @staticmethod
    def get_resubmission_rate_trend():
        """
        Calculate the weekly resubmission-rate trend.

        For each period, the denominator contains applications that received
        a rejection review during that period.

        The numerator contains rejected applications that were resubmitted
        during the same period.

        Each application is counted once per period.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        def get_period_rate(start, end):
            rejected_applications = (
                MerchantApplication.objects
                .filter(
                    reviews__MAREV_DECISION=(
                        MerchantApplicationReview.Decision.REJECTED
                    ),
                    reviews__MAREV_REVIEWED_AT__date__gte=start,
                    reviews__MAREV_REVIEWED_AT__date__lte=end,
                )
                .distinct()
            )

            total_rejected = rejected_applications.count()

            if total_rejected == 0:
                return None, 0

            resubmitted = rejected_applications.filter(
                submissions__MASUB_SUBMISSION_NUMBER__gte=2,
                submissions__MASUB_SUBMITTED_AT__date__gte=start,
                submissions__MASUB_SUBMITTED_AT__date__lte=end,
            ).distinct().count()

            return (
                round(
                    (resubmitted / total_rejected) * 100,
                    1,
                ),
                total_rejected,
            )

        current_rate, current_sample = get_period_rate(
            periods["current_start"],
            periods["current_end"],
        )

        previous_rate, previous_sample = get_period_rate(
            periods["previous_start"],
            periods["previous_end"],
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
    def get_approval_rate_trend():
        """
        Calculate the weekly approval-rate trend.

        Each application is counted once per period using its latest
        review within that period. This prevents resubmitted applications
        from being counted multiple times.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        # Helper function to calculate the approval rate for a given period
        def get_period_rate(start, end):
            reviews = list(
                MerchantApplicationReview.objects
                .filter(
                    MAREV_REVIEWED_AT__date__gte=start,
                    MAREV_REVIEWED_AT__date__lte=end,
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
            periods["current_end"],
        )

        previous_rate, previous_sample = get_period_rate(
            periods["previous_start"],
            periods["previous_end"],
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
    def get_resubmission_rate_history():
        """
        Return daily resubmission-rate values for the KPI sparkline.

        An application is considered resubmitted only if a second or later
        submission existed by the historical date being evaluated.
        """

        dates = (
            MerchantApplicationAnalyticsService
            .get_daily_analytics_periods()
        )

        history = []

        for date in dates:
            reviewed_applications = (
                MerchantApplicationReview.objects
                .filter(
                    MAREV_REVIEWED_AT__date=date,
                )
                .values("MAPP_ID")
                .distinct()
            )

            application_ids = list(
                reviewed_applications.values_list(
                    "MAPP_ID",
                    flat=True,
                )
            )

            total_reviewed = len(application_ids)

            if total_reviewed == 0:
                value = None
            else:
                resubmitted = (
                    MerchantApplicationSubmission.objects
                    .filter(
                        MAPP_ID__in=application_ids,
                        MASUB_SUBMISSION_NUMBER__gte=2,
                        MASUB_SUBMITTED_AT__date__lte=date,
                    )
                    .values("MAPP_ID")
                    .distinct()
                    .count()
                )

                value = round(
                    (resubmitted / total_reviewed) * 100,
                    1,
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