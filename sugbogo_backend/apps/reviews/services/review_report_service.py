
from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import Review, ReviewReport
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.users.models import User


class ReviewReportService:
    """Handles reporting business reviews."""

    SPAM_REPORT_THRESHOLD = 3

    @staticmethod
    @transaction.atomic
    def create_report(
        user: User,
        review_id: int,
        report_type: str,
        device_id: str | None = None,
    ) -> ReviewReport:
        """Record a report and flag reviews whose report count reaches three."""
        try:
            review = Review.objects.select_for_update().get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        try:
            report = ReviewReport.objects.create(
                REVW_ID=review,
                USER_ID=user,
                RREP_TYPE=report_type,
                RREP_DEVICE_ID=device_id,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already reported this review.",
            ) from None

        Review.objects.filter(
            REVW_ID=review.REVW_ID,
        ).update(
            REVW_REPORT_COUNT=models.F(
                "REVW_REPORT_COUNT",
            ) + 1,
        )

        # Read the incremented count in SQL; never clear an existing flag.
        newly_flagged = Review.objects.filter(
            REVW_ID=review.REVW_ID,
            REVW_REPORT_COUNT__gte=ReviewReportService.SPAM_REPORT_THRESHOLD,
            REVW_IS_SPAM_FLAGGED=False,
        ).update(
            REVW_IS_SPAM_FLAGGED=True,
        )

        if newly_flagged:
            ReviewModerationConsistencyService.refresh_excluded_review(
                business_id=review.BUSN_ID_id,
                review_id=review.REVW_ID,
            )

        return report
