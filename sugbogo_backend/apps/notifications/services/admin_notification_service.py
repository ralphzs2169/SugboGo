from apps.merchant_application.models import MerchantApplication
from apps.notifications.services.notification_service import NotificationService
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class AdminNotificationService:
    """Fan out actionable workflow events to each active administrator's inbox."""

    TARGET_TYPES = (
        "admin_merchant_application",
        "admin_review_moderation",
        "admin_reported_review",
        "admin_review_dispute",
    )

    @staticmethod
    def _notify(
        *,
        event_type,
        title,
        body,
        dedup_key,
        target_type,
        target_id,
    ):
        """Reuse recipient-event uniqueness and commit-time publication for every admin."""
        recipients = User.objects.filter(
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_ROLE__in=(
                User.UserRole.ADMIN,
                User.UserRole.SUPER_ADMIN,
            ),
        )
        for recipient in recipients.iterator():
            NotificationService.create(
                recipient=recipient,
                event_type=event_type,
                title=title,
                body=body,
                dedup_key=dedup_key,
                target_type=target_type,
                target_id=target_id,
            )

    @staticmethod
    def merchant_application_submitted(submission):
        """Identify each submitted application attempt by its persisted submission row."""
        application = submission.MAPP_ID
        if application.MAPP_STATUS != MerchantApplication.ApplicationStatus.SUBMITTED:
            return
        AdminNotificationService._notify(
            event_type="admin_merchant_application_submitted",
            title="Merchant application submitted",
            body=(
                f"{application.identity.MIDN_BUSINESS_NAME} has submitted "
                "a merchant application for review."
            ),
            dedup_key=f"admin:merchant-application-submission:{submission.pk}:submitted",
            target_type="admin_merchant_application",
            target_id=application.pk,
        )

    @staticmethod
    def review_moderation_required(review):
        """Notify once when automated checks leave a review requiring human action."""
        if review.REVW_STATUS != Review.ReviewStatus.UNDER_REVIEW:
            return
        metadata = review.REVW_MODERATION_DATA
        if not isinstance(metadata, dict):
            return
        actionable = (
            metadata.get("outcome") == "flagged"
            or (
                metadata.get("outcome") == "provider_failure"
                and metadata.get("retry_exhausted") is True
            )
        )
        if not actionable:
            return
        AdminNotificationService._notify(
            event_type="admin_review_moderation_required",
            title="Review needs moderation",
            body=f"A review of {review.BUSN_ID.BUSN_NAME} needs human moderation.",
            dedup_key=f"admin:review:{review.pk}:human-moderation",
            target_type="admin_review_moderation",
            target_id=review.pk,
        )

    @staticmethod
    def review_report_received(report):
        """Notify once for each accepted pending report and target its review workspace."""
        if report.RREP_STATUS != ReviewReport.ReportStatus.PENDING:
            return
        AdminNotificationService._notify(
            event_type="admin_review_report_received",
            title="Review report received",
            body=f"A review of {report.REVW_ID.BUSN_ID.BUSN_NAME} has been reported.",
            dedup_key=f"admin:review-report:{report.pk}:received",
            target_type="admin_reported_review",
            target_id=report.REVW_ID_id,
        )

    @staticmethod
    def review_dispute_filed(dispute):
        """Notify once for a merchant's persisted pending dispute."""
        if dispute.MRDSP_STATUS != MerchantReviewDispute.DisputeStatus.PENDING:
            return
        AdminNotificationService._notify(
            event_type="admin_review_dispute_filed",
            title="Review dispute filed",
            body=f"A merchant has disputed a review of {dispute.BUSN_ID.BUSN_NAME}.",
            dedup_key=f"admin:review-dispute:{dispute.pk}:filed",
            target_type="admin_review_dispute",
            target_id=dispute.pk,
        )
