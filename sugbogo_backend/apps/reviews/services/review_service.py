from django.db import IntegrityError, models, transaction
from django.db.models import Exists, OuterRef, Prefetch
from django.db.models.functions import Greatest
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.business.models import Business
from apps.reviews.models import (
    Review,
    ReviewLike,
    ReviewPhoto,
)
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewService:
    """Handles creating, updating, deleting, liking, and reporting business reviews."""

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

                uploaded_public_ids.append(
                    public_id,
                )

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
    def _get_review(
        review_id: int,
    ) -> Review:
        try:
            return (
                Review.objects
                .select_related("BUSN_ID")
                .get(
                    REVW_ID=review_id,
                )
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

    @staticmethod
    def list_reviews(
        business_id: int,
        user: User,
    ):
        try:
            Business.objects.get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        likes = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )

        return (
            Review.objects
            .filter(
                BUSN_ID=business_id,
            )
            .select_related(
                "USER_ID",
            )
            .annotate(
                is_liked=Exists(likes),
            )
            .prefetch_related(
                "photos",
                Prefetch(
                    "reply__photos",
                ),
            )
        )

    @staticmethod
    @transaction.atomic
    def update_review(
        user: User,
        review_id: int,
        text: str | None = None,
        photos: list | None = None,
        keep_photo_ids: list | None = None,
    ) -> Review:
        review = ReviewService._get_review(
            review_id,
        )

        if review.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to update this review.",
            )

        existing_photos = list(
            review.photos.all(),
        )

        if keep_photo_ids is not None:
            keep_ids = set(
                keep_photo_ids,
            )
        else:
            keep_ids = {
                photo.RPHO_ID
                for photo in existing_photos
            }

        existing_ids = {
            photo.RPHO_ID
            for photo in existing_photos
        }

        if not keep_ids.issubset(
            existing_ids,
        ):
            raise ValidationError(
                "One or more review photos could not be found.",
            )

        new_photos = photos or []

        if len(keep_ids) + len(new_photos) > 3:
            raise ValidationError(
                "You can only upload a maximum of 3 photos.",
            )

        uploaded_public_ids = []

        removed_photos = [
            photo
            for photo in existing_photos
            if photo.RPHO_ID not in keep_ids
        ]

        try:
            if text is not None:
                review.REVW_TEXT = text

                review.save(
                    update_fields=[
                        "REVW_TEXT",
                        "REVW_UPDATED_AT",
                    ],
                )

            for photo in new_photos:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/reviews",
                )

                public_id = upload_result["public_id"]

                uploaded_public_ids.append(
                    public_id,
                )

                ReviewPhoto.objects.create(
                    REVW_ID=review,
                    RPHO_PHOTO_URL=upload_result["secure_url"],
                    RPHO_PHOTO_PUBLIC_ID=public_id,
                )

            for photo in removed_photos:
                CloudinaryService.delete_image(
                    photo.RPHO_PHOTO_PUBLIC_ID,
                )

                photo.delete()

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        return review

    @staticmethod
    @transaction.atomic
    def delete_review(
        user: User,
        review_id: int,
    ) -> None:
        review = ReviewService._get_review(
            review_id,
        )

        if review.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to delete this review.",
            )

        public_ids = list(
            review.photos.values_list(
                "RPHO_PHOTO_PUBLIC_ID",
                flat=True,
            ),
        )

        try:
            reply = review.reply
        except Review.reply.RelatedObjectDoesNotExist:
            reply = None

        if reply:
            public_ids.extend(
                reply.photos.values_list(
                    "RPHO_PHOTO_PUBLIC_ID",
                    flat=True,
                ),
            )

        for public_id in public_ids:
            CloudinaryService.delete_image(
                public_id,
            )

        business_id = review.BUSN_ID_id

        review.delete()

        Business.objects.filter(
            BUSN_ID=business_id,
        ).update(
            BUSN_REVIEW_COUNT=Greatest(
                models.F("BUSN_REVIEW_COUNT") - 1,
                0,
            ),
        )

    @staticmethod
    @transaction.atomic
    def delete_photo(
        user: User,
        photo_id: int,
    ) -> None:
        try:
            photo = (
                ReviewPhoto.objects
                .select_related("REVW_ID")
                .get(
                    RPHO_ID=photo_id,
                )
            )
        except ReviewPhoto.DoesNotExist:
            raise NotFound(
                "The review photo could not be found.",
            )

        if photo.REVW_ID.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to delete this review photo.",
            )

        CloudinaryService.delete_image(
            photo.RPHO_PHOTO_PUBLIC_ID,
        )

        photo.delete()

   