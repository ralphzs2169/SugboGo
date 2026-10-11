
from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class ReviewReportService:
    """Handles reporting business reviews."""

    REPORT_ATTENTION_THRESHOLD = 3

    @staticmethod
    def recompute_report_flag(review: Review) -> bool:
        """Set attention from pending reports while the caller holds the review lock."""
        pending_count = ReviewReport.objects.filter(
            REVW_ID=review,
            RREP_STATUS=ReviewReport.ReportStatus.PENDING,
        ).count()
        should_flag = (
            review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
            and pending_count >= ReviewReportService.REPORT_ATTENTION_THRESHOLD
        )
        if review.REVW_IS_REPORT_FLAGGED != should_flag:
            Review.objects.filter(pk=review.pk).update(
                REVW_IS_REPORT_FLAGGED=should_flag,
            )
            review.REVW_IS_REPORT_FLAGGED = should_flag

        return should_flag

    @staticmethod
    @transaction.atomic
    def create_report(
        user: User,
        review_id: int,
        report_type: str,
        installation_id: str | None = None,
    ) -> ReviewReport:
        """Record a pending concern about another user's published review."""
        try:
            review = Review.objects.select_for_update().get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        if review.USER_ID_id == user.pk:
            raise ValidationError("You cannot report your own review.")

        if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED:
            raise ValidationError("Only published reviews can be reported.")

        try:
            report = ReviewReport.objects.create(
                REVW_ID=review,
                USER_ID=user,
                RREP_TYPE=report_type,
                RREP_INSTALLATION_ID=installation_id,
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

        ReviewReportService.recompute_report_flag(review)

        return report
