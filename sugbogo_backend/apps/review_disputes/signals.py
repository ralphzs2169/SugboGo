from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver
from django.utils import timezone

from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
    MerchantReviewDisputeSnapshot,
)
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService


@receiver(pre_delete, sender=Review)
def preserve_review_disputes(
    sender,
    instance,
    **kwargs,
):
    """Close cases on direct or parent cascades before clearing the live relation."""
    review = Review.objects.select_for_update(of=("self",)).get(pk=instance.pk)
    ReviewMediaCleanupService.register_review_assets(review)
    MerchantReviewDispute.objects.filter(
        REVW_ID_id=review.pk,
        MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
    ).update(
        MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.REVIEW_REMOVED,
        MRDSP_CLOSURE_REASON="original_review_removed",
        MRDSP_RESOLVED_AT=timezone.now(),
        MRDSP_UPDATED_AT=timezone.now(),
    )


@receiver(post_delete, sender=MerchantReviewDisputeSnapshot)
def release_snapshot_assets(
    sender,
    instance,
    **kwargs,
):
    """Queue released identities while the worker still checks all other owners."""
    ReviewMediaCleanupService.register_assets(
        review_id=instance.MRDS_REVIEW_ID,
        assets={
            (photo["public_id"], photo["resource_type"])
            for photo in instance.MRDS_PHOTOS
            if photo["public_id"]
        },
    )


@receiver(post_delete, sender=MerchantReviewDisputeEvidence)
def release_merchant_evidence(
    sender,
    instance,
    **kwargs,
):
    """Use durable cleanup for merchant evidence, including privacy purges."""
    resource_type = "image"
    if instance.MRDSE_TYPE == MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT:
        resource_type = "raw"
    ReviewMediaCleanupService.register_assets(
        review_id=instance.MRDSP_ID.MRDSP_ORIGINAL_REVIEW_ID,
        assets={(instance.MRDSE_PUBLIC_ID, resource_type)},
    )


@receiver(post_delete, sender=ReviewPhoto)
def release_review_photo(
    sender,
    instance,
    **kwargs,
):
    """Reawaken deferred cleanup when a live photo reference is removed."""
    ReviewMediaCleanupService.register_assets(
        review_id=instance.REVW_ID_id,
        assets={(instance.RPHO_PHOTO_PUBLIC_ID, "image")},
    )
