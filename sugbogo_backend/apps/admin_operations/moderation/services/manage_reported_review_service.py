"""Transactional review-level decisions for grouped community reports."""

from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)
from apps.reviews.models import Review, ReviewReport
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.reviews.services.review_report_service import ReviewReportService
from apps.users.models import User
from apps.users.services.reputation_service import ReputationService


class ManageReportedReviewService:
    """Resolve a review's pending reports together without repeated lifecycle effects."""

    @staticmethod
    @transaction.atomic
    def resolve(
        review_id,
        *,
        actor,
        decision,
        admin_notes,
    ):
        """Lock the review and pending reports, then apply one content decision."""
        try:
            review = (
                Review.objects
                .select_related("USER_ID")
                .select_for_update()
                .get(pk=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The reported review could not be found.") from None

        reports = list(
            ReviewReport.objects
            .select_related("USER_ID")
            .select_for_update(of=("self",))
            .filter(
                REVW_ID_id=review.pk,
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            )
            .order_by("RREP_ID")
        )
        if not reports:
            raise ValidationError("No pending reports remain for this review.")

        if decision not in ("keep", "reject", "confirm", "dismiss"):
            raise ValidationError("Choose a valid decision for this review.")

        previous_status = review.REVW_STATUS
        if decision == "keep" and previous_status != Review.ReviewStatus.PUBLISHED:
            raise ValidationError("Only a published review can be kept.")
        if decision == "reject" and previous_status not in (
            Review.ReviewStatus.PUBLISHED,
            Review.ReviewStatus.REJECTED,
        ):
            raise ValidationError("Only a published or rejected review can be resolved.")
        if (
            decision in ("confirm", "dismiss")
            and previous_status != Review.ReviewStatus.REJECTED
        ):
            raise ValidationError(
                "Only an already-rejected review can have reports resolved separately."
            )

        confirming = decision in ("reject", "confirm")
        if confirming:
            # Preserve the existing per-report reporter reward and one author penalty.
            account_ids = {review.USER_ID_id}
            account_ids.update(report.USER_ID_id for report in reports)
            list(
                User.objects
                .select_for_update()
                .filter(pk__in=account_ids)
                .order_by("pk")
            )

        resolved_status = (
            ReviewReport.ReportStatus.APPROVED
            if confirming
            else ReviewReport.ReportStatus.REJECTED
        )
        for report in reports:
            report.RREP_STATUS = resolved_status
            report.RREP_NOTES = admin_notes
            report.save(
                update_fields=["RREP_STATUS", "RREP_NOTES", "RREP_UPDATED_AT"],
            )

        if confirming and previous_status == Review.ReviewStatus.PUBLISHED:
            review, _ = ReviewModerationConsistencyService.reject_review(
                review.pk,
            )
            ReputationService.apply_confirmed_violation_penalty(
                user_id=review.USER_ID_id,
                review_id=review.pk,
            )

        ReviewReportService.recompute_report_flag(review)

        if confirming:
            for report in reports:
                if report.USER_ID_id != review.USER_ID_id:
                    ReputationService.apply_approved_report_reward(
                        user_id=report.USER_ID_id,
                        source_id=report.pk,
                    )

        if previous_status == Review.ReviewStatus.REJECTED:
            audit_action = (
                AdminActivity.Action.REVIEW_REPORT_APPROVED
                if confirming
                else AdminActivity.Action.REVIEW_REPORT_REJECTED
            )
        else:
            audit_action = (
                AdminActivity.Action.REPORTED_REVIEW_REJECTED
                if confirming
                else AdminActivity.Action.REPORTED_REVIEW_KEPT
            )

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=review.USER_ID,
            action=audit_action,
            context={
                "review_id": review.pk,
                "business_id": review.BUSN_ID_id,
                "report_ids": [report.pk for report in reports],
                "report_count": len(reports),
                "decision": decision,
                "admin_notes": admin_notes,
                "previous_review_status": previous_status,
                "review_status": review.REVW_STATUS,
            },
        )
        NotificationEventService.reported_review_resolved(
            reports=reports,
            review=review,
            previous_review_status=previous_status,
        )
        return {
            "review_id": review.pk,
            "review_status": review.REVW_STATUS,
            "decision": decision,
            "resolved_report_count": len(reports),
        }
