from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import BusinessSpecialtyTag
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.services.reputation_service import ReputationService


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
    ) -> MerchantReviewDispute:
        try:
            return (
                ManageReviewDisputeService
                ._detail_queryset()
                .get(
                    MRDSP_ID=dispute_id,
                )
            )
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
    ) -> MerchantReviewDispute:
        """Uphold a dispute and penalize the review author in one transaction."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
        )

        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Only pending review disputes can be upheld.",
            )

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

        return dispute

    @staticmethod
    @transaction.atomic
    def dismiss_dispute(
        dispute_id: int,
        admin_notes: str | None = None,
    ) -> MerchantReviewDispute:
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
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

        return dispute
