from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.utils.application_queue import count_business_days


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
            total_applications=Count("MAPP_ID"),
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
             "pending_review_trend": (
                MerchantApplicationAnalyticsService
                .get_pending_review_trend()
            ),
            "sla_compliance_rate_trend": (
                MerchantApplicationAnalyticsService
                .get_sla_compliance_rate_trend()
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
    def calculate_trend(
        current_value,
        previous_value,
        current_sample_size,
        previous_sample_size,
        minimum_sample_size=10,
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

        completed_reviews = (
            MerchantApplicationReview.objects
            .select_related("MASUB_ID")
            .filter(MASUB_ID__isnull=False)
        )

        total_reviews = completed_reviews.count()

        if total_reviews == 0:
            return None

        compliant_reviews = 0

        for review in completed_reviews:
            business_days = count_business_days(
                review.MASUB_ID.MASUB_SUBMITTED_AT,
                review.MAREV_REVIEWED_AT,
            )

            if business_days < APPLICATION_REVIEW_SLA_BUSINESS_DAYS:
                compliant_reviews += 1

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
            reviews = list(
                MerchantApplicationReview.objects
                .select_related("MASUB_ID")
                .filter(
                    MASUB_ID__isnull=False,
                    MAREV_REVIEWED_AT__date__gte=start,
                    MAREV_REVIEWED_AT__date__lte=end,
                )
            )

            total_reviews = len(reviews)

            if total_reviews == 0:
                return None, 0

            compliant_reviews = 0

            for review in reviews:
                business_days = count_business_days(
                    review.MASUB_ID.MASUB_SUBMITTED_AT,
                    review.MAREV_REVIEWED_AT,
                )

                if business_days < APPLICATION_REVIEW_SLA_BUSINESS_DAYS:
                    compliant_reviews += 1

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
        Calculate the percentage of reviewed applications that were
        subsequently resubmitted.

        Each application is counted once regardless of how many times
        it was resubmitted.

        The denominator contains applications with at least one completed
        review. Draft and never-reviewed submitted applications are excluded.
        """

        reviewed_applications = (
            MerchantApplication.objects
            .filter(reviews__isnull=False)
            .distinct()
        )

        total_reviewed = reviewed_applications.count()

        if total_reviewed == 0:
            return None

        resubmitted = reviewed_applications.filter(
            MAPP_SUBMISSION_COUNT__gte=2,
        ).count()

        return round(
            (resubmitted / total_reviewed) * 100,
            1,
        )


    @staticmethod
    def get_resubmission_rate_trend():
        """
        Calculate the weekly resubmission-rate trend.

        Each application is counted once per period. The denominator
        contains applications that received at least one completed review
        during the period. An application is considered resubmitted when
        its submission count is at least 2.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        def get_period_rate(start, end):
            reviewed_applications = (
                MerchantApplication.objects
                .filter(
                    reviews__MAREV_REVIEWED_AT__date__gte=start,
                    reviews__MAREV_REVIEWED_AT__date__lte=end,
                )
                .distinct()
            )

            total_reviewed = reviewed_applications.count()

            if total_reviewed == 0:
                return None, 0

            resubmitted = reviewed_applications.filter(
                MAPP_SUBMISSION_COUNT__gte=2,
            ).count()

            return (
                round(
                    (resubmitted / total_reviewed) * 100,
                    1,
                ),
                total_reviewed,
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
    def get_pending_review_trend():
        """
        Calculate the weekly trend in submissions pending administrator
        review.

        A submission is considered pending at a historical cutoff when it
        was submitted on or before that date and had not yet received a
        review by that date.

        Each submission is evaluated independently, so resubmissions are
        treated as separate review events.
        """

        periods = (
            MerchantApplicationAnalyticsService
            .get_weekly_analytics_periods()
        )

        def get_period_pending_count(cutoff):
            reviewed_submission_ids = (
                MerchantApplicationReview.objects
                .filter(
                    MASUB_ID=OuterRef("pk"),
                    MAREV_REVIEWED_AT__date__lte=cutoff,
                )
                .values("MAREV_ID")
            )

            submissions = (
                MerchantApplicationSubmission.objects
                .filter(
                    MASUB_SUBMITTED_AT__date__lte=cutoff,
                )
                .annotate(
                    was_reviewed=Exists(reviewed_submission_ids),
                )
            )

            total_submissions = submissions.count()

            pending_count = submissions.filter(
                was_reviewed=False,
            ).count()

            return pending_count, total_submissions

        current_pending, current_sample = get_period_pending_count(
            periods["current_end"],
        )

        previous_pending, previous_sample = get_period_pending_count(
            periods["previous_end"],
        )

        return MerchantApplicationAnalyticsService.calculate_trend(
            current_value=current_pending,
            previous_value=previous_pending,
            current_sample_size=current_sample,
            previous_sample_size=previous_sample,
            unit="count",
        )