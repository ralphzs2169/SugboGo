from apps.merchant_application.models import MerchantApplicationReview
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.services.vouch_notification_service import (
    VouchNotificationService,
)
from apps.reviews.models import Review
from apps.users.models import User


class NotificationEventService:
    """Create private recipient notices inside the owning transaction."""

    @staticmethod
    def business_vouch_received(vouch):
        """Combine a new vouch with the sender's recent unread specialty notice."""
        VouchNotificationService.record(vouch)

    @staticmethod
    def business_review_received(review):
        """Notify the business owner once when a review becomes public."""
        if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED:
            return

        author_name = review.USER_ID.full_name.strip()
        author = author_name or "An explorer"
        NotificationService.create(
            recipient=review.BUSN_ID.USER_ID,
            event_type="business_review_received",
            title="New review received",
            body=f"{author} left a review. See what they shared and reply.",
            dedup_key=f"business-review:{review.pk}:published",
            target_type="business_review",
            target_id=review.pk,
        )

    @staticmethod
    def under_review_resolved(review):
        """Notify the author of an Admin decision on a held review."""
        business_name = review.BUSN_ID.BUSN_NAME
        if review.REVW_STATUS == Review.ReviewStatus.PUBLISHED:
            event_type = "review_published"
            title = "Review published"
            body = (
                f"Your review of {business_name} has been approved "
                "and is now visible to the community."
            )
            outcome = "published"
        elif review.REVW_STATUS == Review.ReviewStatus.REJECTED:
            event_type = "review_rejected"
            title = "Review not approved"
            body = (
                f"Your review of {business_name} was not approved "
                "and will not be published."
            )
            outcome = "rejected"
        else:
            return

        NotificationService.create(
            recipient=review.USER_ID,
            event_type=event_type,
            title=title,
            body=body,
            dedup_key=f"review:{review.pk}:{outcome}",
        )

    @staticmethod
    def review_cases_closed_by_author(
        *,
        author_id: int,
        pending_reports: list[dict],
        pending_disputes: list[dict],
        business_name: str = "",
    ) -> None:
        """Notify locked pending case submitters without targeting deleted resources."""
        recipient_ids = {
            case["USER_ID_id"]
            for case in pending_reports + pending_disputes
            if case["USER_ID_id"] != author_id
        }
        if not recipient_ids:
            return
        recipients = User.objects.in_bulk(recipient_ids)
        business_context = ""
        if business_name:
            business_context = f" for {business_name}"
        for report in pending_reports:
            recipient = recipients.get(report["USER_ID_id"])
            if recipient is None:
                continue
            NotificationService.create(
                recipient=recipient,
                event_type="review_report_closed_by_author",
                title="Report closed",
                body=(
                    f"The review you reported{business_context} was removed by its author. "
                    "Your report has been closed without an Admin decision."
                ),
                dedup_key=f"review-report:{report['RREP_ID']}:author-removed",
            )
        for dispute in pending_disputes:
            recipient = recipients.get(dispute["USER_ID_id"])
            if recipient is None:
                continue
            NotificationService.create(
                recipient=recipient,
                event_type="review_dispute_closed_by_author",
                title="Review dispute closed",
                body=(
                    f"The review you disputed{business_context} was removed by its author. "
                    "Your dispute has been closed without an Admin decision."
                ),
                dedup_key=f"review-dispute:{dispute['MRDSP_ID']}:author-removed",
            )

    @staticmethod
    def review_report_resolved(
        report,
        review,
        previous_review_status,
        *,
        business_name=None,
    ):
        """Notify the reporter of an outcome and the author of a new rejection."""
        outcome = report.RREP_STATUS
        if business_name is None:
            business_name = review.BUSN_ID.BUSN_NAME
        NotificationService.create(
            recipient=report.USER_ID,
            event_type=f"review_report_{outcome}",
            title="Review report decision",
            body=f"Your report about a review of {business_name} was {outcome}.",
            dedup_key=f"review-report:{report.pk}:resolved",
        )
        if outcome == "approved":
            NotificationEventService._review_rejected(
                review,
                previous_review_status,
                business_name=business_name,
            )

    @staticmethod
    def reported_review_resolved(*, reports, review, previous_review_status):
        """Notify each reporter and the author once for a review-level decision."""
        for report in reports:
            NotificationEventService.review_report_resolved(
                report,
                review,
                Review.ReviewStatus.REJECTED,
            )
        if review.REVW_STATUS == Review.ReviewStatus.REJECTED:
            NotificationEventService._review_rejected(
                review,
                previous_review_status,
            )

    @staticmethod
    def review_dispute_resolved(dispute, previous_review_status):
        """Notify the submitting merchant without claiming review clearance."""
        outcome = dispute.MRDSP_STATUS
        business_name = dispute.BUSN_ID.BUSN_NAME
        NotificationService.create(
            recipient=dispute.USER_ID,
            event_type=f"review_dispute_{outcome}",
            title="Review dispute decision",
            body=f"Your review dispute for {business_name} was {outcome}.",
            dedup_key=f"review-dispute:{dispute.pk}:resolved",
            target_type="review_dispute",
            target_id=dispute.pk,
        )
        if outcome == "upheld":
            NotificationEventService._review_rejected(
                dispute.REVW_ID,
                previous_review_status,
                business_name=business_name,
            )

    @staticmethod
    def _review_rejected(
        review,
        previous_review_status,
        *,
        business_name=None,
    ):
        """Record at most one author rejection notice across moderation paths."""
        if previous_review_status == Review.ReviewStatus.REJECTED:
            return
        if business_name is None:
            business_name = review.BUSN_ID.BUSN_NAME
        NotificationService.create(
            recipient=review.USER_ID,
            event_type="review_rejected",
            title="Review moderation decision",
            body=f"Your review of {business_name} was rejected after moderation inspection.",
            dedup_key=f"review:{review.pk}:rejected",
        )

    @staticmethod
    def merchant_request_resolved(
        *,
        recipient,
        request_id,
        request_type,
        outcome,
        business_name,
    ):
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
            body=f"Your {label} request for {business_name} was {outcome}.",
            dedup_key=f"{request_type}:{request_id}:resolved",
            target_type=request_type,
            target_id=request_id,
        )

    @staticmethod
    def merchant_application_resolved(review):
        """Notify an applicant once for a persisted submission decision."""
        business_name = review.MAPP_ID.identity.MIDN_BUSINESS_NAME
        content = {
            MerchantApplicationReview.Decision.APPROVED: (
                "Application Approved",
                (
                    f"Your merchant application for {business_name} has been approved. "
                    "You can now access Merchant mode."
                ),
            ),
            MerchantApplicationReview.Decision.REJECTED: (
                "Application Update",
                (
                    f"Your merchant application for {business_name} was not approved. "
                    "Review the feedback for more details."
                ),
            ),
        }
        title, body = content[review.MAREV_DECISION]

        NotificationService.create(
            recipient=review.MAPP_ID.USER_ID,
            event_type=f"merchant_application_{review.MAREV_DECISION}",
            title=title,
            body=body,
            dedup_key=(
                "merchant-application-submission:"
                f"{review.MASUB_ID_id}:resolved"
            ),
            target_type="merchant_application",
            target_id=review.MAPP_ID_id,
        )
