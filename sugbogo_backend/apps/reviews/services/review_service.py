from django.db import IntegrityError, models, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.reviews.models import (
    Review,
    ReviewLike,
    ReviewPhoto,
    ReviewReport,
)
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewService:
    """Handles creating, liking, and reporting business reviews."""

    @staticmethod
    @transaction.atomic
    def create_review(
        user: User,
        business_id: int,
        text: str,
        photos: list | None = None,
        device_id: str | None = None,
    ) -> Review:
        try:
            business = Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        try:
            review = Review.objects.create(
                USER_ID=user,
                BUSN_ID=business,
                REVW_TEXT=text,
                REVW_DEVICE_ID=device_id,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already reviewed this business.",
            ) from None

        uploaded_public_ids = []

        try:
            for photo in photos or []:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/reviews",
                )

                public_id = upload_result["public_id"]

                ReviewPhoto.objects.create(
                    REVW_ID=review,
                    RPHO_PHOTO_URL=upload_result["secure_url"],
                    RPHO_PHOTO_PUBLIC_ID=public_id,
                )

                uploaded_public_ids.append(public_id)

            Business.objects.filter(
                BUSN_ID=business.BUSN_ID,
            ).update(
                BUSN_REVIEW_COUNT=models.F("BUSN_REVIEW_COUNT") + 1,
            )

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        return review



    @staticmethod
    @transaction.atomic
    def create_like(
        user: User,
        review_id: int,
    ) -> ReviewLike:
        try:
            review = Review.objects.get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        try:
            like = ReviewLike.objects.create(
                REVW_ID=review,
                USER_ID=user,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already liked this review.",
            )

        Review.objects.filter(
            REVW_ID=review.REVW_ID,
        ).update(
            REVW_LIKE_COUNT=models.F("REVW_LIKE_COUNT") + 1,
        )

        return like

    @staticmethod
    @transaction.atomic
    def remove_like(
        user: User,
        review_id: int,
    ) -> None:
        try:
            like = ReviewLike.objects.get(
                REVW_ID=review_id,
                USER_ID=user,
            )
        except ReviewLike.DoesNotExist:
            raise NotFound(
                "Your like could not be found.",
            )

        like.delete()

        Review.objects.filter(
            REVW_ID=review_id,
        ).update(
            REVW_LIKE_COUNT=models.F("REVW_LIKE_COUNT") - 1,
        )

    @staticmethod
    def has_liked(
        user: User,
        review_id: int,
    ) -> bool:
        return ReviewLike.objects.filter(
            REVW_ID=review_id,
            USER_ID=user,
        ).exists()

    @staticmethod
    @transaction.atomic
    def create_report(
        user: User,
        review_id: int,
        report_type: str,
        device_id: str | None = None,
    ) -> ReviewReport:
        try:
            review = Review.objects.get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        report = ReviewReport.objects.create(
            REVW_ID=review,
            USER_ID=user,
            RREP_TYPE=report_type,
            RREP_DEVICE_ID=device_id,
        )

        Review.objects.filter(
            REVW_ID=review.REVW_ID,
        ).update(
            REVW_REPORT_COUNT=models.F("REVW_REPORT_COUNT") + 1,
        )

        return report