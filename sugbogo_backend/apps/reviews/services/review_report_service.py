
from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class ReviewReportService:
    """Handles reporting business reviews."""

    @staticmethod
    @transaction.atomic
    def create_report(
        user: User,
        review_id: int,
        report_type: str,
        device_id: str | None = None,
    ) -> ReviewReport:
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

        return report