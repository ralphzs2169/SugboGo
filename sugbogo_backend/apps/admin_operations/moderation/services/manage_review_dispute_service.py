from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review


class ManageReviewDisputeService:
    """Handles administrator-facing review dispute moderation."""

    @staticmethod
    def _detail_queryset():
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
                "evidence",
                "REVW_ID__photos",
                "REVW_ID__reports",
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
    @transaction.atomic
    def uphold_dispute(
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