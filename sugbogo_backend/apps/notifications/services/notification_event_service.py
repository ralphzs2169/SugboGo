from apps.notifications.services.notification_service import NotificationService
from apps.reviews.models import Review


class NotificationEventService:
    """Create private recipient notices inside the owning decision transaction."""

    @staticmethod
    def review_report_resolved(report, review, previous_review_status):
        """Notify the reporter of an outcome and the author of a new rejection."""
        outcome = report.RREP_STATUS
        NotificationService.create(
            recipient=report.USER_ID,
            event_type=f"review_report_{outcome}",
            title="Review report decision",
            body=f"Your review report was {outcome} after inspection.",
            dedup_key=f"review-report:{report.pk}:resolved",
        )
        if outcome == "approved":
            NotificationEventService._review_rejected(review, previous_review_status)

    @staticmethod
    def review_dispute_resolved(dispute, previous_review_status):
        """Notify the submitting merchant without claiming review clearance."""
        outcome = dispute.MRDSP_STATUS
        NotificationService.create(
            recipient=dispute.USER_ID,
            event_type=f"review_dispute_{outcome}",
            title="Review dispute decision",
            body=f"Your review dispute was {outcome} after inspection.",
            dedup_key=f"review-dispute:{dispute.pk}:resolved",
            target_type="review_dispute",
            target_id=dispute.pk,
        )
        if outcome == "upheld":
            NotificationEventService._review_rejected(
                dispute.REVW_ID, previous_review_status,
            )

    @staticmethod
    def _review_rejected(review, previous_review_status):
        """Record at most one author rejection notice across moderation paths."""
        if previous_review_status == Review.ReviewStatus.REJECTED:
            return
        NotificationService.create(
            recipient=review.USER_ID,
            event_type="review_rejected",
            title="Review moderation decision",
            body="Your review was rejected after moderation inspection.",
            dedup_key=f"review:{review.pk}:rejected",
        )

    @staticmethod
    def merchant_request_resolved(*, recipient, request_id, request_type, outcome):
        """Notify a merchant of a request decision using an owned resource hint."""
        labels = {
            "business_name_change": "business name change",
            "business_classification_change": "business classification change",
            "business_location_change": "business location change",
        }
        label = labels[request_type]
        NotificationService.create(
            recipient=recipient,
            event_type=f"{request_type}_{outcome}",
            title="Business request decision",
            body=f"Your {label} request was {outcome} after inspection.",
            dedup_key=f"{request_type}:{request_id}:resolved",
            target_type=request_type,
            target_id=request_id,
        )
