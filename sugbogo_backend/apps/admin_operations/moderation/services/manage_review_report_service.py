from django.db import transaction
from django.db.models import Count
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.reviews.models import Review, ReviewReport
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.users.models import User
from apps.users.services.reputation_service import ReputationService
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)


class ManageReviewReportService:
    """Lists reports and applies auditable administrator resolutions."""

    @staticmethod
    def queryset():
        """Loads report details without exposing device identifiers."""
        return ReviewReport.objects.select_related(
            "USER_ID", "REVW_ID", "REVW_ID__USER_ID", "REVW_ID__BUSN_ID",
        ).prefetch_related("REVW_ID__photos")

    @staticmethod
    def list_reports(filters):
        """Filters reports with deterministic newest-first pagination."""
        queryset = ManageReviewReportService.queryset()
        for key, field in {
            "status": "RREP_STATUS", "type": "RREP_TYPE",
            "business": "REVW_ID__BUSN_ID_id", "review": "REVW_ID_id",
        }.items():
            if key in filters:
                queryset = queryset.filter(**{field: filters[key]})
        return queryset.order_by("-RREP_CREATED_AT", "-RREP_ID")

    @staticmethod
    def get_report(report_id):
        """Retrieves a report or raises a controlled missing-resource error."""
        try:
            return ManageReviewReportService.queryset().get(pk=report_id)
        except ReviewReport.DoesNotExist:
            raise NotFound("The review report could not be found.") from None

    @staticmethod
    def related_counts(report):
        """Returns report counts for the same review grouped by decision state."""
        rows = ReviewReport.objects.filter(REVW_ID_id=report.REVW_ID_id).values(
            "RREP_STATUS",
        ).annotate(count=Count("RREP_ID"))
        counts = dict.fromkeys(ReviewReport.ReportStatus.values, 0)
        counts.update({row["RREP_STATUS"]: row["count"] for row in rows})
        return counts

    @staticmethod
    @transaction.atomic
    def resolve(report_id, *, actor, admin_notes, approve):
        """Resolves a pending report with atomic reputation and audit effects."""
        source = ManageReviewReportService.get_report(report_id)
        # Match report submission's review-first lock order across competing reports.
        try:
            review = Review.objects.select_for_update().get(pk=source.REVW_ID_id)
            report = ManageReviewReportService.queryset().select_for_update(
                of=("self",),
            ).get(pk=report_id)
        except (Review.DoesNotExist, ReviewReport.DoesNotExist):
            raise NotFound("The review report could not be found.") from None
        if report.RREP_STATUS != ReviewReport.ReportStatus.PENDING:
            raise ValidationError("Only pending review reports can be resolved.")

        previous_status = review.REVW_STATUS
        report.RREP_STATUS = (
            ReviewReport.ReportStatus.APPROVED if approve
            else ReviewReport.ReportStatus.REJECTED
        )
        report.RREP_NOTES = admin_notes
        report.save(update_fields=["RREP_STATUS", "RREP_NOTES", "RREP_UPDATED_AT"])

        if approve:
            # Lock both reputation accounts in order before applying either event.
            list(User.objects.select_for_update().filter(
                pk__in={review.USER_ID_id, report.USER_ID_id},
            ).order_by("pk"))
            review.REVW_STATUS = Review.ReviewStatus.REJECTED
            review.save(update_fields=["REVW_STATUS", "REVW_UPDATED_AT"])
            ReputationService.apply_confirmed_violation_penalty(
                user_id=review.USER_ID_id, review_id=review.pk,
            )
            if report.USER_ID_id != review.USER_ID_id:
                ReputationService.apply_approved_report_reward(
                    user_id=report.USER_ID_id, source_id=report.pk,
                )
            ReviewModerationConsistencyService.refresh_excluded_review(
                business_id=review.BUSN_ID_id, review_id=review.pk,
            )

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=review.USER_ID,
            action=(AdminActivity.Action.REVIEW_REPORT_APPROVED if approve
                    else AdminActivity.Action.REVIEW_REPORT_REJECTED),
            context={
                "report_id": report.pk, "review_id": review.pk,
                "business_id": review.BUSN_ID_id, "reporter_id": report.USER_ID_id,
                "report_type": report.RREP_TYPE, "admin_notes": admin_notes,
                "previous_report_status": ReviewReport.ReportStatus.PENDING,
                "report_status": report.RREP_STATUS,
                "previous_review_status": previous_status,
                "review_status": review.REVW_STATUS,
            },
        )
        NotificationEventService.review_report_resolved(report, review, previous_status)
        return ManageReviewReportService.get_report(report_id)
