from django.db import IntegrityError, transaction
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.reviews.constants import MAX_REVIEW_PHOTOS
from apps.reviews.models import (
    ReplyPhoto,
    Review,
    ReviewReply,
)
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User


class ReviewReplyService:
    """Handles creating, updating, and deleting business-owner replies."""

    @staticmethod
    @transaction.atomic
    def create_reply(
        user: User,
        review_id: int,
        text: str,
        photos: list | None = None,
    ) -> ReviewReply:
        try:
            review = (
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

        if review.BUSN_ID.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to reply to this review.",
            )

        try:
            reply = ReviewReply.objects.create(
                REVW_ID=review,
                RPLY_TEXT=text,
            )
        except IntegrityError:
            raise ValidationError(
                "This review already has a reply.",
            ) from None

        uploaded_public_ids = []

        try:
            for photo in photos or []:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/review-replies",
                )

                public_id = upload_result["public_id"]

                uploaded_public_ids.append(
                    public_id,
                )

                ReplyPhoto.objects.create(
                    RPLY_ID=reply,
                    RPHO_PHOTO_URL=upload_result["secure_url"],
                    RPHO_PHOTO_PUBLIC_ID=public_id,
                )

            return reply

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

    @staticmethod
    def _get_reply(
        reply_id: int,
    ) -> ReviewReply:
        try:
            return (
                ReviewReply.objects
                .select_related(
                    "REVW_ID__BUSN_ID",
                )
                .get(
                    RPLY_ID=reply_id,
                )
            )
        except ReviewReply.DoesNotExist:
            raise NotFound(
                "The review reply could not be found.",
            )

    @staticmethod
    def _ensure_owner(
        reply: ReviewReply,
        user: User,
    ) -> None:
        if reply.REVW_ID.BUSN_ID.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to manage this review reply.",
            )

    @staticmethod
    @transaction.atomic
    def update_reply(
        user: User,
        reply_id: int,
        text: str | None = None,
        photos: list | None = None,
        keep_photo_ids: list | None = None,
    ) -> ReviewReply:
        reply = ReviewReplyService._get_reply(
            reply_id,
        )

        ReviewReplyService._ensure_owner(
            reply,
            user,
        )

        existing_photos = list(
            reply.photos.all(),
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
                "One or more reply photos could not be found.",
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
                reply.RPLY_TEXT = text

                reply.save(
                    update_fields=[
                        "RPLY_TEXT",
                        "RPLY_UPDATED_AT",
                    ],
                )

            for photo in new_photos:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/review-replies",
                )

                public_id = upload_result["public_id"]

                uploaded_public_ids.append(
                    public_id,
                )

                ReplyPhoto.objects.create(
                    RPLY_ID=reply,
                    RPHO_PHOTO_URL=upload_result["secure_url"],
                    RPHO_PHOTO_PUBLIC_ID=public_id,
                )

            for photo in removed_photos:
                CloudinaryService.delete_image(
                    photo.RPHO_PHOTO_PUBLIC_ID,
                )

            ReplyPhoto.objects.filter(
                RPHO_ID__in=[photo.RPHO_ID for photo in removed_photos],
            ).delete()

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        return reply

    @staticmethod
    @transaction.atomic
    def delete_reply(
        user: User,
        reply_id: int,
    ) -> None:
        reply = ReviewReplyService._get_reply(
            reply_id,
        )

        ReviewReplyService._ensure_owner(
            reply,
            user,
        )

        public_ids = reply.photos.values_list(
            "RPHO_PHOTO_PUBLIC_ID",
            flat=True,
        )

        for public_id in public_ids:
            CloudinaryService.delete_image(
                public_id,
            )

        reply.delete()

    @staticmethod
    @transaction.atomic
    def delete_photo(
        user: User,
        photo_id: int,
    ) -> None:
        try:
            photo = (
                ReplyPhoto.objects
                .select_related(
                    "RPLY_ID__REVW_ID__BUSN_ID",
                )
                .get(
                    RPHO_ID=photo_id,
                )
            )
        except ReplyPhoto.DoesNotExist:
            raise NotFound(
                "The reply photo could not be found.",
            )

        ReviewReplyService._ensure_owner(
            photo.RPLY_ID,
            user,
        )

        CloudinaryService.delete_image(
            photo.RPHO_PHOTO_PUBLIC_ID,
        )

        photo.delete()