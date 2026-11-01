"""Lightweight persisted operational counts for the Admin Dashboard."""

from django.db.models import Count
from django.utils import timezone

from apps.business.models import Business
from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.utils.application_queue import (
    get_application_queue_aging_filters,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport


class DashboardSummaryService:
    """Read current operational inventories without loading workflow lists or analytics."""

    @staticmethod
    def get_summary():
        """Assemble live SQL counts with a shared aging reference, without atomic snapshot guarantees."""
        as_of = timezone.now()
        aging_filters = get_application_queue_aging_filters(
            reference_time=as_of,
        )
        applications = (
            MerchantApplication.objects
            .filter(
                MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
            )
            .aggregate(
                pending_review=Count("MAPP_ID"),
                on_time=Count(
                    "MAPP_ID",
                    filter=aging_filters["on_time"],
                ),
                approaching=Count(
                    "MAPP_ID",
                    filter=aging_filters["approaching"],
                ),
                overdue=Count(
                    "MAPP_ID",
                    filter=aging_filters["overdue"],
                ),
            )
        )
        aging = {
            "on_time": applications["on_time"],
            "approaching": applications["approaching"],
            "overdue": applications["overdue"],
        }
        # Missing/future submission times or inconsistent review timestamps
        # remain outside the same three age groups used by the list filters.
        aging["unknown_age"] = (
            applications["pending_review"] - sum(aging.values())
        )

        change_requests = {
            "business_name": (
                BusinessNameChangeRequest.objects
                .filter(
                    BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
                )
                .count()
            ),
            "classification": (
                BusinessClassificationChangeRequest.objects
                .filter(
                    BCCR_STATUS=BusinessClassificationChangeRequest.Status.PENDING,
                )
                .count()
            ),
            "location": (
                BusinessLocationChangeRequest.objects
                .filter(
                    BLCR_STATUS=BusinessLocationChangeRequest.Status.PENDING,
                )
                .count()
            ),
        }
        reviews_under_review = Review.objects.filter(
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        ).count()
        reported_review_cases = (
            ReviewReport.objects
            .filter(
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            )
            .aggregate(
                total=Count(
                    "REVW_ID",
                    distinct=True,
                ),
            )["total"]
        )
        pending_disputes = MerchantReviewDispute.objects.filter(
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
        ).count()
        active_businesses = Business.objects.filter(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        ).count()

        return {
            "as_of": as_of,
            "applications": {
                "pending_review": applications["pending_review"],
                "aging": aging,
            },
            "change_requests": {
                "pending_total": sum(change_requests.values()),
                "by_type": change_requests,
            },
            "reviews_under_review": reviews_under_review,
            "reported_review_cases": reported_review_cases,
            "pending_disputes": pending_disputes,
            "active_businesses": active_businesses,
        }
