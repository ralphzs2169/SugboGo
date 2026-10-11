"""Recover reviews held only because content moderation could not complete."""

from django.db import transaction

from apps.reviews.models import Review
from apps.reviews.services.review_moderation_service import ReviewModerationService
from apps.reviews.services.review_service import ReviewService


class ReviewModerationRetryService:
    """Recheck immutable held content and apply a result under a row lock."""

    @staticmethod
    def _is_retryable(
        review: Review,
        expected_attempt: int,
    ) -> bool:
        metadata = review.REVW_MODERATION_DATA
        if not isinstance(metadata, dict):
            return False

        findings = metadata.get("findings", [])
        if not isinstance(findings, list):
            return False

        return (
            review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW
            and metadata.get("outcome") == "provider_failure"
            and metadata.get("retryable", True) is True
            and metadata.get("retry_exhausted", False) is False
            and metadata.get("retry_attempt", 0) == expected_attempt
            and not any(
                finding.get("flagged") is True
                for finding in findings
                if isinstance(finding, dict)
            )
        )

    @staticmethod
    def retry(
        review_id: int,
        expected_attempt: int,
        max_retries: int,
    ) -> str:
        """Return stale, published, flagged, provider_failure, or exhausted."""
        review = (
            Review.objects
            .filter(REVW_ID=review_id)
            .first()
        )
        if review is None or not ReviewModerationRetryService._is_retryable(
            review,
            expected_attempt,
        ):
            return "stale"

        photos = list(review.photos.all().order_by("RPHO_ID"))
        photo_identity = [
            (photo.RPHO_ID, photo.RPHO_PHOTO_URL)
            for photo in photos
        ]
        text = review.REVW_TEXT
        image_urls = [
            photo.RPHO_PHOTO_URL
            for photo in photos
        ]

        # No database lock or service transaction surrounds the provider call.
        moderation = ReviewModerationService.moderate(
            text=text,
            image_urls=image_urls,
        )

        with transaction.atomic():
            current = (
                Review.objects
                .select_for_update()
                .filter(REVW_ID=review_id)
                .first()
            )
            if current is None or not ReviewModerationRetryService._is_retryable(
                current,
                expected_attempt,
            ):
                return "stale"

            current_photo_identity = list(
                current.photos
                .order_by("RPHO_ID")
                .values_list("RPHO_ID", "RPHO_PHOTO_URL")
            )
            if current.REVW_TEXT != text or current_photo_identity != photo_identity:
                return "stale"

            for finding in moderation["findings"]:
                photo_index = finding["photo_index"]
                if photo_index is not None:
                    finding["photo_id"] = photos[photo_index].RPHO_ID

            previous_metadata = current.REVW_MODERATION_DATA
            moderation["retry_attempt"] = expected_attempt + 1
            moderation["last_attempted_at"] = moderation["checked_at"]
            moderation["last_provider_failure"] = previous_metadata.get(
                "last_provider_failure",
                previous_metadata.get("failure_type"),
            )

            if moderation["outcome"] == "provider_failure":
                exhausted = expected_attempt >= max_retries
                moderation["retryable"] = not exhausted
                moderation["retry_exhausted"] = exhausted
                moderation["last_provider_failure"] = moderation["failure_type"]
            else:
                moderation["retryable"] = False
                moderation["retry_exhausted"] = False

            current.REVW_MODERATION_DATA = moderation
            current.save(
                update_fields=[
                    "REVW_MODERATION_DATA",
                    "REVW_UPDATED_AT",
                ],
            )

            if moderation["outcome"] == "safe":
                ReviewService.publish_under_review(current.REVW_ID)
                return "published"
            if moderation["outcome"] == "flagged":
                return "flagged"
            if moderation["retry_exhausted"]:
                return "exhausted"
            return "provider_failure"
