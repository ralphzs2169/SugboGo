
from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import Review, ReviewReport
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
            review = Review.objects.get(
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
        Review.objects.filter(
            REVW_ID=review.REVW_ID,
            REVW_REPORT_COUNT__gte=ReviewReportService.SPAM_REPORT_THRESHOLD,
        ).update(
            REVW_IS_SPAM_FLAGGED=True,
        )

        return report
