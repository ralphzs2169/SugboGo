"""Offline publication fixture for tests outside the moderation workflow."""

from unittest.mock import patch


def create_and_moderate_review(
    *args,
    **kwargs,
):
    """Advance a downstream test fixture through creation and its stored-content check."""
    from apps.reviews.services.review_moderation_retry_service import ReviewModerationRetryService
    from apps.reviews.services.review_service import ReviewService

    review = ReviewService.create_review(*args, **kwargs)
    ReviewModerationRetryService.retry(review.pk)
    review.refresh_from_db()
    return review


class SafeReviewModerationMixin:
    """Keep established review tests independent of the moderation provider."""

    @classmethod
    def setUpClass(cls):
        """Treat review submissions in this test class as safe."""
        cls._safe_moderation_patcher = patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "model": "omni-moderation-latest",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "failure_type": None,
                "image_count": 0,
                "findings": [],
            },
        )
        cls._safe_moderation_patcher.start()
        try:
            super().setUpClass()
        except Exception:
            cls._safe_moderation_patcher.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        """Restore the moderation service after this test class."""
        try:
            super().tearDownClass()
        finally:
            cls._safe_moderation_patcher.stop()
