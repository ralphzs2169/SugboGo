import hashlib
import json

from django.db import transaction
from rest_framework.exceptions import APIException

from apps.review_disputes.models import MerchantReviewDisputeSnapshot
from apps.reviews.models import Review
from apps.reviews.services.review_media_lock_service import lock_review_media_assets


class DisputeContentConflict(APIException):
    """Require a fresh investigation when the reviewed content is no longer current."""

    status_code = 409
    default_code = "review_content_changed"
    default_detail = "The review changed. Refresh the investigation before deciding."


class ReviewSnapshotService:
    """Capture filing evidence and compare only material text and photo identities."""

    @staticmethod
    def photos(review):
        """Use primary-key order, matching the review's existing photo display order."""
        return [
            {
                "id": photo.RPHO_ID,
                "url": photo.RPHO_PHOTO_URL,
                "public_id": photo.RPHO_PHOTO_PUBLIC_ID,
                "resource_type": "image",
                "display_order": index,
            }
            for index, photo in enumerate(
                sorted(
                    review.photos.all(),
                    key=lambda photo: photo.RPHO_ID,
                ),
            )
        ]

    @staticmethod
    def fingerprint(
        text,
        photos,
    ):
        """Hash exact text and ordered stable identities without mutable metadata."""
        content = {
            "text": text,
            "photos": [
                [photo["id"], photo["public_id"], photo["resource_type"]]
                for photo in photos
            ],
        }
        return hashlib.sha256(
            json.dumps(
                content,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8"),
        ).hexdigest()

    @staticmethod
    def current_fingerprint(review):
        """Compute the decision token from current material review content."""
        return ReviewSnapshotService.fingerprint(
            review.REVW_TEXT,
            ReviewSnapshotService.photos(review),
        )

    @staticmethod
    @transaction.atomic
    def capture(dispute):
        """Create exactly one snapshot after acquiring the review and asset locks."""
        review = Review.objects.select_for_update(of=("self",)).get(
            pk=dispute.REVW_ID_id,
        )
        photos = ReviewSnapshotService.photos(review)
        lock_review_media_assets(
            (photo["public_id"], photo["resource_type"])
            for photo in photos
        )
        return MerchantReviewDisputeSnapshot.objects.create(
            MRDSP_ID=dispute,
            MRDS_REVIEW_ID=review.pk,
            MRDS_AUTHOR_ID=review.USER_ID_id,
            MRDS_BUSINESS_ID=review.BUSN_ID_id,
            MRDS_TEXT=review.REVW_TEXT,
            MRDS_STATUS=review.REVW_STATUS,
            MRDS_SUBMITTED_AT=review.REVW_CREATED_AT,
            MRDS_EDITED_AT=review.REVW_EDITED_AT,
            MRDS_PHOTOS=photos,
            MRDS_FINGERPRINT=ReviewSnapshotService.fingerprint(
                review.REVW_TEXT,
                photos,
            ),
        )

    @staticmethod
    def at_filing(dispute):
        """Expose historical evidence only through investigation serializers."""
        snapshot = getattr(dispute, "snapshot", None)
        if snapshot is None:
            return {
                "available": False,
                "message": "Filing-time snapshot unavailable",
            }
        return {
            "available": True,
            "review_id": snapshot.MRDS_REVIEW_ID,
            "author_id": snapshot.MRDS_AUTHOR_ID,
            "business_id": snapshot.MRDS_BUSINESS_ID,
            "text": snapshot.MRDS_TEXT,
            "status": snapshot.MRDS_STATUS,
            "submitted_at": snapshot.MRDS_SUBMITTED_AT,
            "edited_at": snapshot.MRDS_EDITED_AT,
            "captured_at": snapshot.MRDS_CAPTURED_AT,
            "photos": [
                {
                    "id": photo["id"],
                    "url": photo["url"],
                    "display_order": photo["display_order"],
                }
                for photo in snapshot.MRDS_PHOTOS
            ],
            "fingerprint": snapshot.MRDS_FINGERPRINT,
        }
