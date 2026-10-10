from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import BusinessSpecialtyTag
from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.users.models import User
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.users.services.reputation_service import ReputationService
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)


class ManageReviewDisputeService:
    """Handles administrator-facing review dispute moderation."""

    @staticmethod
    def _detail_queryset():
        active_specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
        )

        return (
            MerchantReviewDispute.objects
            .select_related(
                "BUSN_ID",
                "BUSN_ID__USER_ID",
                "REVW_ID",
                "REVW_ID__USER_ID",
                "USER_ID",
            )
            .prefetch_related(
                Prefetch(
                    "BUSN_ID__specialty_tag_links",
                    queryset=active_specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
                "evidence",
                "REVW_ID__photos",
                "REVW_ID__reports",
                "REVW_ID__reply",
            )
        )

    @staticmethod
    def list_disputes(
        status=None,
        reason=None,
        business_id=None,
        review_id=None,
        ordering=None,
    ):
        queryset = ManageReviewDisputeService._detail_queryset()

        if status:
            queryset = queryset.filter(
                MRDSP_STATUS=status,
            )

        if reason:
            queryset = queryset.filter(
                MRDSP_REASON=reason,
            )

        if business_id:
            queryset = queryset.filter(
                BUSN_ID=business_id,
            )

        if review_id:
            queryset = queryset.filter(
                REVW_ID=review_id,
            )

        ordering_map = {
            "created_at": "MRDSP_CREATED_AT",
            "-created_at": "-MRDSP_CREATED_AT",
            "status": "MRDSP_STATUS",
            "-status": "-MRDSP_STATUS",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "-MRDSP_CREATED_AT",
            ),
        )

    @staticmethod
    def get_dispute(
        dispute_id: int,
        *,
        for_update: bool = False,
    ) -> MerchantReviewDispute:
        """Retrieves dispute details and optionally locks its decision state."""
        try:
            queryset = ManageReviewDisputeService._detail_queryset()
            if for_update:
                queryset = queryset.select_for_update(of=("self",))
            return queryset.get(MRDSP_ID=dispute_id)
        except MerchantReviewDispute.DoesNotExist:
            raise NotFound(
                "The review dispute could not be found.",
            )


    @staticmethod
    def get_dispute_detail(
        dispute_id: int,
    ) -> MerchantReviewDispute:
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
        )

        review_disputes = list(
            MerchantReviewDispute.objects
            .filter(
                REVW_ID_id=dispute.REVW_ID_id,
            )
            .prefetch_related("evidence")
            .order_by(
                "MRDSP_CREATED_AT",
                "MRDSP_ID",
            )
        )

        attempt_number = next(
            (
                index
                for index, attempt in enumerate(
                    review_disputes,
                    start=1,
                )
                if attempt.MRDSP_ID == dispute.MRDSP_ID
            ),
            1,
        )

        previous_disputes = [
            attempt
            for attempt in review_disputes[:attempt_number - 1]
        ]

        dispute.attempt_number = attempt_number
        dispute.previous_dispute_count = len(previous_disputes)
        dispute.previous_disputes = list(
            reversed(previous_disputes),
        )

        return dispute

    
    @staticmethod
    @transaction.atomic
    def uphold_dispute(
        dispute_id: int,
        admin_notes: str | None = None,
        *,
        actor: User,
    ) -> MerchantReviewDispute:
        """Uphold a dispute and penalize the review author in one transaction."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
            for_update=True,
        )

        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Only pending review disputes can be upheld.",
            )

        previous_review_status = dispute.REVW_ID.REVW_STATUS

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.UPHELD
        )
        dispute.MRDSP_ADMIN_NOTES = admin_notes
        dispute.MRDSP_RESOLVED_AT = timezone.now()

        dispute.save(
            update_fields=[
                "MRDSP_STATUS",
                "MRDSP_ADMIN_NOTES",
                "MRDSP_RESOLVED_AT",
                "MRDSP_UPDATED_AT",
            ],
        )

        Review.objects.filter(
            REVW_ID=dispute.REVW_ID_id,
        ).update(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )

        ReputationService.apply_confirmed_violation_penalty(
            user_id=dispute.REVW_ID.USER_ID_id,
            review_id=dispute.REVW_ID_id,
        )

        ReviewModerationConsistencyService.refresh_excluded_review(
            business_id=dispute.REVW_ID.BUSN_ID_id,
            review_id=dispute.REVW_ID_id,
        )

        ManageReviewDisputeService._record_resolution(
            actor, dispute, AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
            previous_review_status, Review.ReviewStatus.REJECTED,
        )
        NotificationEventService.review_dispute_resolved(dispute, previous_review_status)
        return dispute

    @staticmethod
    @transaction.atomic
    def dismiss_dispute(
        dispute_id: int,
        admin_notes: str | None = None,
        *,
        actor: User,
    ) -> MerchantReviewDispute:
        """Dismisses a pending dispute and records its administrator decision."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
            for_update=True,
        )

        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Only pending review disputes can be dismissed.",
            )

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.DISMISSED
        )
        dispute.MRDSP_ADMIN_NOTES = admin_notes
        dispute.MRDSP_RESOLVED_AT = timezone.now()

        dispute.save(
            update_fields=[
                "MRDSP_STATUS",
                "MRDSP_ADMIN_NOTES",
                "MRDSP_RESOLVED_AT",
                "MRDSP_UPDATED_AT",
            ],
        )

        ManageReviewDisputeService._record_resolution(
            actor, dispute, AdminActivity.Action.REVIEW_DISPUTE_DISMISSED,
            dispute.REVW_ID.REVW_STATUS, dispute.REVW_ID.REVW_STATUS,
        )
        NotificationEventService.review_dispute_resolved(
            dispute, dispute.REVW_ID.REVW_STATUS,
        )
        return dispute

    @staticmethod
    def _record_resolution(
        actor,
        dispute,
        action,
        previous_review_status,
        review_status,
    ):
        """Records the administrator and state transition for a dispute decision."""
        AdminActivityService.record_user_action(
            actor=actor,
            target_user=dispute.REVW_ID.USER_ID,
            action=action,
            context={
                "dispute_id": dispute.MRDSP_ID,
                "review_id": dispute.REVW_ID_id,
                "business_id": dispute.REVW_ID.BUSN_ID_id,
                "reason": dispute.MRDSP_REASON,
                "admin_notes": dispute.MRDSP_ADMIN_NOTES,
                "previous_dispute_status": MerchantReviewDispute.DisputeStatus.PENDING,
                "dispute_status": dispute.MRDSP_STATUS,
                "previous_review_status": previous_review_status,
                "review_status": review_status,
            },
        )
