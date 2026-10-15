from django.db.models import OuterRef, Subquery

from apps.business.models import Business
from apps.business.services.display_cover_photo import (
    display_cover_photo_expression,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class MyReviewService:
    """Builds the authenticated author's retained cross-business review history."""

    @staticmethod
    def list_reviews_queryset(
        user: User,
    ):
        """Return only the author's reviews without public visibility filters."""
        display_business = (
            Business.objects
            .filter(
                BUSN_ID=OuterRef("BUSN_ID_id"),
            )
            .annotate(
                display_cover_photo_url=display_cover_photo_expression(),
            )
            .values("display_cover_photo_url")[:1]
        )

        return (
            ReviewService._annotated_review_queryset(user)
            .filter(
                USER_ID=user,
            )
            .select_related(
                "BUSN_ID",
                "BUSN_ID__CTGRY_ID",
                "reply",
            )
            .annotate(
                my_review_display_cover_photo_url=Subquery(display_business),
            )
            .order_by(
                "-REVW_CREATED_AT",
                "-REVW_ID",
            )
        )
