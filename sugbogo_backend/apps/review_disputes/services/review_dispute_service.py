from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business
from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
)
from apps.reviews.models import Review
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewDisputeService:
    """Handles merchant-facing review dispute operations."""

    @staticmethod
    def _get_owned_dispute(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        try:
            dispute = (
                MerchantReviewDispute.objects
                .select_related(
                    "BUSN_ID",
                    "REVW_ID",
                    "USER_ID",
                )
                .prefetch_related("evidence")
                .get(MRDSP_ID=dispute_id)
            )
        except MerchantReviewDispute.DoesNotExist:
            raise NotFound(
                "The review dispute could not be found.",
            )

        if dispute.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to access this review dispute.",
            )

        return dispute

    @staticmethod
    @transaction.atomic
    def create_dispute(
        user: User,
        review_id: int,
        reason: str,
        description: str,
    ) -> MerchantReviewDispute:
        try:
            review = (
                Review.objects
                .select_related("BUSN_ID")
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        try:
            business = Business.objects.get(
                BUSN_ID=review.BUSN_ID_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        if business.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to dispute this review.",
            )

        try:
            return MerchantReviewDispute.objects.create(
                REVW_ID=review,
                BUSN_ID=business,
                USER_ID=user,
                MRDSP_REASON=reason,
                MRDSP_DESCRIPTION=description,
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )
        except IntegrityError:
            raise ValidationError(
                "An active dispute already exists for this review.",
            ) from None

    @staticmethod
    def get_dispute(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        return ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
        )

    @staticmethod
    def list_merchant_disputes(user: User):
        return (
            MerchantReviewDispute.objects
            .filter(USER_ID=user)
            .select_related("BUSN_ID", "REVW_ID")
            .prefetch_related("evidence")
        )

    @staticmethod
    def add_evidence(
        user: User,
        dispute_id: int,
        evidence_type: str,
        file,
    ) -> MerchantReviewDisputeEvidence:
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
        )

        if dispute.MRDSP_STATUS != MerchantReviewDispute.DisputeStatus.PENDING:
            raise ValidationError(
                "Evidence can only be added to a pending review dispute.",
            )

        resource_type = "image"

        if evidence_type == MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT:
            resource_type = "raw"

        upload_result = CloudinaryService.upload_image(
            file,
            folder="sugbogo/review-disputes",
            resource_type=resource_type,
        )

        public_id = upload_result["public_id"]

        try:
            with transaction.atomic():
                return MerchantReviewDisputeEvidence.objects.create(
                    MRDSP_ID=dispute,
                    MRDSE_TYPE=evidence_type,
                    MRDSE_URL=upload_result["secure_url"],
                    MRDSE_PUBLIC_ID=public_id,
                )
        except Exception:
            CloudinaryService.delete_image(public_id)
            raise

    @staticmethod
    @transaction.atomic
    def delete_evidence(
        user: User,
        evidence_id: int,
    ) -> None:
        try:
            evidence = (
                MerchantReviewDisputeEvidence.objects
                .select_related("MRDSP_ID")
                .get(MRDSE_ID=evidence_id)
            )
        except MerchantReviewDisputeEvidence.DoesNotExist:
            raise NotFound(
                "The dispute evidence could not be found.",
            )

        if evidence.MRDSP_ID.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to delete this dispute evidence.",
            )

        public_id = evidence.MRDSE_PUBLIC_ID

        evidence.delete()
        CloudinaryService.delete_image(public_id)

    @staticmethod
    @transaction.atomic
    def withdraw_dispute(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
        )

        if dispute.MRDSP_STATUS != MerchantReviewDispute.DisputeStatus.PENDING:
            raise ValidationError(
                "Only a pending review dispute can be withdrawn.",
            )

        dispute.MRDSP_STATUS = MerchantReviewDispute.DisputeStatus.WITHDRAWN
        dispute.MRDSP_RESOLVED_AT = timezone.now()
        dispute.save(
            update_fields=[
                "MRDSP_STATUS",
                "MRDSP_RESOLVED_AT",
                "MRDSP_UPDATED_AT",
            ],
        )

        return dispute
