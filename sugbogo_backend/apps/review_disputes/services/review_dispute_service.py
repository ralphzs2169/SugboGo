from django.db import IntegrityError, transaction
from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business
from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
)
from apps.reviews.models import Review
from apps.review_disputes.services.review_snapshot_service import ReviewSnapshotService
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewDisputeService:
    """Handles merchant-facing review dispute operations."""

    MAX_EVIDENCE_FILES = 5

    @staticmethod
    def _with_attempt_number(
        queryset,
        user: User,
    ):
        """Annotate disputes with their attempt number for the same review."""

        previous_attempt_count = (
            MerchantReviewDispute.objects
            .filter(
                MRDSP_ORIGINAL_REVIEW_ID=OuterRef("MRDSP_ORIGINAL_REVIEW_ID"),
                USER_ID_id=user.USER_ID,
                MRDSP_CREATED_AT__lt=OuterRef("MRDSP_CREATED_AT"),
            )
            .values("MRDSP_ORIGINAL_REVIEW_ID")
            .annotate(count=Count("MRDSP_ID"))
            .values("count")[:1]
        )

        return queryset.annotate(
            attempt_number=(
                Coalesce(
                    Subquery(
                        previous_attempt_count,
                        output_field=IntegerField(),
                    ),
                    Value(0),
                )
                + Value(1)
            ),
        )

    @staticmethod
    def _set_attempt_number(
        dispute: MerchantReviewDispute,
        user: User,
    ) -> None:
        """Attach the dispute attempt number to a single dispute instance."""

        previous_dispute_count = (
            MerchantReviewDispute.objects
            .filter(
                MRDSP_ORIGINAL_REVIEW_ID=dispute.MRDSP_ORIGINAL_REVIEW_ID,
                USER_ID_id=user.USER_ID,
                MRDSP_CREATED_AT__lt=dispute.MRDSP_CREATED_AT,
            )
            .count()
        )

        dispute.attempt_number = previous_dispute_count + 1

    @staticmethod
    def _get_owned_dispute(
        user: User,
        dispute_id: int,
        *,
        for_update: bool = False,
    ) -> MerchantReviewDispute:
        """Retrieve an owned dispute and lock its review first when updating."""
        try:
            queryset = (
                MerchantReviewDispute.objects
                .select_related(
                    "BUSN_ID",
                    "REVW_ID",
                    "REVW_ID__USER_ID",
                    "USER_ID",
                    "snapshot",
                )
                .prefetch_related(
                    "evidence",
                    "REVW_ID__photos",
                )
            )
            if for_update:
                review_id = (
                    MerchantReviewDispute.objects
                    .values_list("REVW_ID_id", flat=True)
                    .get(MRDSP_ID=dispute_id)
                )
                # Re-read ownership and eligibility only after both locks are held.
                if review_id is not None:
                    Review.objects.select_for_update(of=("self",)).filter(
                        REVW_ID=review_id,
                    ).first()
                queryset = queryset.select_for_update(of=("self",))
            dispute = queryset.get(MRDSP_ID=dispute_id)
        except (Review.DoesNotExist, MerchantReviewDispute.DoesNotExist):
            raise NotFound(
                "The review dispute could not be found.",
            ) from None

        if dispute.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to access this review dispute.",
            )

        if (
            dispute.REVW_ID is not None
            and dispute.REVW_ID.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW
        ):
            raise NotFound(
                "The review dispute could not be found.",
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
        """Capture filing content under the same parent lock used by review mutations."""
        try:
            review = (
                Review.objects
                .select_for_update(of=("self",))
                .select_related(
                    "BUSN_ID",
                    "USER_ID",
                )
                .prefetch_related("photos")
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

        if review.REVW_STATUS != Review.ReviewStatus.PUBLISHED:
            raise ValidationError(
                "This review can no longer be disputed.",
            )

        try:
            with transaction.atomic():
                dispute = MerchantReviewDispute.objects.create(
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

        ReviewSnapshotService.capture(dispute)

        ReviewDisputeService._set_attempt_number(
            dispute,
            user,
        )

        return dispute

    @staticmethod
    def get_dispute(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
        )

        ReviewDisputeService._set_attempt_number(
            dispute,
            user,
        )

        return dispute

    @staticmethod
    @transaction.atomic
    def get_dispute_detail(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        """Read owned attempts and coherent current content for snapshot comparison."""
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
            for_update=True,
        )

        previous_disputes = list(
            MerchantReviewDispute.objects
            .filter(
                MRDSP_ORIGINAL_REVIEW_ID=dispute.MRDSP_ORIGINAL_REVIEW_ID,
                USER_ID_id=user.USER_ID,
                MRDSP_CREATED_AT__lt=dispute.MRDSP_CREATED_AT,
            )
            .prefetch_related("evidence")
            .order_by("-MRDSP_CREATED_AT")
        )

        dispute.previous_disputes = previous_disputes
        dispute.previous_dispute_count = len(previous_disputes)
        dispute.attempt_number = dispute.previous_dispute_count + 1

        return dispute

    @staticmethod
    def list_merchant_disputes(
        user: User,
        status_filter: str = "all",
    ):
        """List owned disputes with filtering before pagination and counting."""
        queryset = (
            MerchantReviewDispute.objects
            .filter(USER_ID=user)
            .exclude(REVW_ID__REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW)
            .select_related(
                "BUSN_ID",
                "REVW_ID",
                "REVW_ID__USER_ID",
            )
            .prefetch_related(
                "evidence",
                "REVW_ID__photos",
            )
        )

        if status_filter == "pending":
            queryset = queryset.filter(
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )
        elif status_filter == "resolved":
            queryset = queryset.exclude(
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )

        return ReviewDisputeService._with_attempt_number(
            queryset,
            user,
        )

    @staticmethod
    def add_evidence(
        user: User,
        dispute_id: int,
        evidence_type: str,
        file,
    ) -> MerchantReviewDisputeEvidence:
        """Finalize an upload only while its locked parent dispute remains pending."""
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
        )

        if dispute.MRDSP_STATUS != MerchantReviewDispute.DisputeStatus.PENDING:
            raise ValidationError(
                "Evidence can only be added to a pending review dispute.",
            )

        if dispute.evidence.count() >= ReviewDisputeService.MAX_EVIDENCE_FILES:
            raise ValidationError(
                "A review dispute can only have up to 5 evidence files.",
            )

        file_name = file.name

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
                dispute = ReviewDisputeService._get_owned_dispute(
                    user,
                    dispute_id,
                    for_update=True,
                )
                if dispute.MRDSP_STATUS != MerchantReviewDispute.DisputeStatus.PENDING:
                    raise ValidationError(
                        "Evidence can only be added to a pending review dispute.",
                    )
                if dispute.evidence.count() >= ReviewDisputeService.MAX_EVIDENCE_FILES:
                    raise ValidationError(
                        "A review dispute can only have up to 5 evidence files.",
                    )
                return MerchantReviewDisputeEvidence.objects.create(
                    MRDSP_ID=dispute,
                    MRDSE_TYPE=evidence_type,
                    MRDSE_FILE_NAME=file_name,
                    MRDSE_URL=upload_result["secure_url"],
                    MRDSE_PUBLIC_ID=public_id,
                )
        except Exception:
            ReviewMediaCleanupService.register_assets(
                review_id=dispute.MRDSP_ORIGINAL_REVIEW_ID,
                assets={(public_id, resource_type)},
            )
            raise

    @staticmethod
    @transaction.atomic
    def delete_evidence(
        user: User,
        evidence_id: int,
    ) -> None:
        """Remove pending-case evidence under parent locks and register durable cleanup."""
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

        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            evidence.MRDSP_ID_id,
            for_update=True,
        )
        try:
            evidence = MerchantReviewDisputeEvidence.objects.select_for_update().get(
                pk=evidence_id,
            )
        except MerchantReviewDisputeEvidence.DoesNotExist:
            raise NotFound("The dispute evidence could not be found.") from None
        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Evidence can only be deleted from a pending review dispute.",
            )

        evidence.delete()

    @staticmethod
    @transaction.atomic
    def withdraw_dispute(
        user: User,
        dispute_id: int,
    ) -> MerchantReviewDispute:
        dispute = ReviewDisputeService._get_owned_dispute(
            user,
            dispute_id,
            for_update=True,
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

        ReviewDisputeService._set_attempt_number(
            dispute,
            user,
        )

        return dispute
