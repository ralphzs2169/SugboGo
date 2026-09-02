from django.db import IntegrityError, models, transaction
from django.db.models import Exists, OuterRef
from django.db.models.functions import Greatest
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.business.models import Business, BusinessVouch
from apps.reviews.constants import MAX_REVIEW_PHOTOS
from apps.reviews.models import (
    Review,
    ReviewLike,
    ReviewPhoto,
)
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewService:
    """Handles creating, updating, and deleting business reviews."""

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

        # Prevent merchants from reviewing their own business.
        if business.USER_ID_id == user.USER_ID:
            raise ValidationError(
                "You cannot review your own business.",
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
                BUSN_REVIEW_COUNT=models.F(
                    "BUSN_REVIEW_COUNT",
                ) + 1,
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
                .select_related(
                    "BUSN_ID",
                )
                .get(
                    REVW_ID=review_id,
                )
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

    @staticmethod
    def _annotated_review_queryset(user: User):
        """Base queryset with review interaction annotations, unfiltered by business."""

        likes = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )

        owner_likes = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=OuterRef("BUSN_ID__USER_ID"),
        )

        own_reviews = Review.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )

        return (
            Review.objects
            .select_related("USER_ID")
            .annotate(
                is_liked=Exists(likes),
                is_liked_by_owner=Exists(owner_likes),
                is_own_review=Exists(own_reviews),
            )
            .prefetch_related(
                "photos",
                "reply__photos",
            )
        )


    @staticmethod
    def _get_review_queryset(business_id: int, user: User):
        """Annotated queryset scoped to a single business, ordered for listing."""

        return (
            ReviewService._annotated_review_queryset(user)
            .filter(
                BUSN_ID=business_id,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            )
            .order_by("-REVW_CREATED_AT")
        )

    @staticmethod
    def get_review_detail(review_id: int, user: User) -> Review:
        """Fetch a single review through the same annotation/attachment path
        used for listing, so the serializer's is_own_review and
        vouched_specialties fields are always populated."""

        try:
            review = ReviewService._annotated_review_queryset(user).get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        return ReviewService._attach_vouched_specialties([review])[0]

    @staticmethod
    def _attach_vouched_specialties(
        reviews,
    ):
        """Attach each review author's business vouches to the review."""

        reviews = list(
            reviews,
        )

        if not reviews:
            return reviews

        business_id = reviews[0].BUSN_ID_id

        user_ids = {
            review.USER_ID_id
            for review in reviews
        }

        vouches = (
            BusinessVouch.objects
            .filter(
                BUSN_ID=business_id,
                USER_ID__in=user_ids,
            )
            .select_related(
                "TAG_ID",
            )
        )

        vouches_by_user = {}

        for vouch in vouches:
            vouches_by_user.setdefault(
                vouch.USER_ID_id,
                [],
            ).append(
                vouch,
            )

        for review in reviews:
            review.vouched_specialties = vouches_by_user.get(
                review.USER_ID_id,
                [],
            )

        return reviews

    @staticmethod
    def get_review_preview(
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

        total_count = Review.objects.filter(
            BUSN_ID=business_id,
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        ).count()

        # Get the first 3 reviews for the business, ordered by creation date (most recent first).
        reviews = ReviewService._get_review_queryset(
            business_id,
            user,
        )[:3]

        return {
            "reviews": ReviewService._attach_vouched_specialties(
                reviews,
            ),
            "total_count": total_count,
        }

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

        reviews = ReviewService._get_review_queryset(
            business_id,
            user,
        )

        return ReviewService._attach_vouched_specialties(
            reviews,
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

        if len(keep_ids) + len(new_photos) > MAX_REVIEW_PHOTOS:
            raise ValidationError(
                f"You can only upload a maximum of {MAX_REVIEW_PHOTOS} photos.",
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

            ReviewPhoto.objects.filter(
                RPHO_ID__in=[photo.RPHO_ID for photo in removed_photos],
            ).delete()

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
                models.F(
                    "BUSN_REVIEW_COUNT",
                ) - 1,
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
                .select_related(
                    "REVW_ID",
                )
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
