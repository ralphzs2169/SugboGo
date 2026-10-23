import logging

from django.db import IntegrityError, transaction
from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.reviews.constants import MAX_REVIEW_PHOTOS
from apps.reviews.models import (
    ReplyPhoto,
    Review,
    ReviewMediaCleanup,
    ReviewPhoto,
    ReviewReply,
)
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User

logger = logging.getLogger(__name__)


class ReviewReplyEditConflict(APIException):
    status_code = 409
    default_detail = "This reply changed while you were editing. Reload it and try again."
    default_code = "REVIEW_REPLY_EDIT_CONFLICT"


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
        """Lock a published review before accepting its business owner's reply."""
        try:
            review = (
                Review.objects
                .select_for_update(of=("self",))
                .select_related("BUSN_ID")
                .get(
                    REVW_ID=review_id,
                    REVW_STATUS=Review.ReviewStatus.PUBLISHED,
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
    def update_reply(
        user: User,
        reply_id: int,
        text: str | None = None,
        photos: list | None = None,
        keep_photo_ids: list | None = None,
    ) -> ReviewReply:
        """Upload outside transactions and apply only to the unchanged locked source."""
        reply = ReviewReplyService._get_reply(
            reply_id,
        )

        ReviewReplyService._ensure_owner(
            reply,
            user,
        )

        existing_photos = list(
            reply.photos.order_by("RPHO_ID"),
        )
        new_photos = photos or []
        source = ReviewReplyService._source_identity(reply, existing_photos)
        ReviewReplyService._validate_photo_selection(
            existing_photos,
            keep_photo_ids,
            len(new_photos),
        )
        uploaded_public_ids = []
        uploaded_photos = []

        try:
            for photo in new_photos:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/review-replies",
                )

                public_id = upload_result["public_id"]

                uploaded_public_ids.append(
                    public_id,
                )
                uploaded_photos.append({
                    "public_id": public_id,
                    "secure_url": upload_result["secure_url"],
                })

            with transaction.atomic():
                current = ReviewReplyService._get_locked_reply(
                    reply_id,
                    reply.REVW_ID_id,
                )
                ReviewReplyService._ensure_owner(current, user)
                current_photos = list(current.photos.order_by("RPHO_ID"))
                if (
                    ReviewReplyService._source_identity(
                        current,
                        current_photos,
                    ) != source
                ):
                    raise ReviewReplyEditConflict()
                keep_ids = ReviewReplyService._validate_photo_selection(
                    current_photos,
                    keep_photo_ids,
                    len(uploaded_photos),
                )
                removed_photos = [
                    photo
                    for photo in current_photos
                    if photo.RPHO_ID not in keep_ids
                ]
                if text is not None:
                    current.RPLY_TEXT = text
                current.save(update_fields=["RPLY_TEXT", "RPLY_UPDATED_AT"])

                for upload in uploaded_photos:
                    ReplyPhoto.objects.create(
                        RPLY_ID=current,
                        RPHO_PHOTO_URL=upload["secure_url"],
                        RPHO_PHOTO_PUBLIC_ID=upload["public_id"],
                    )

                ReviewMediaCleanupService.register_assets(
                    review_id=current.REVW_ID_id,
                    assets={
                        (
                            photo.RPHO_PHOTO_PUBLIC_ID,
                            ReviewMediaCleanup.ResourceType.IMAGE,
                        )
                        for photo in removed_photos
                    },
                )
                ReplyPhoto.objects.filter(
                    RPHO_ID__in=[
                        photo.RPHO_ID
                        for photo in removed_photos
                    ],
                ).delete()
                return current

        except Exception as exc:
            ReviewReplyService._compensate_uploads(
                uploaded_public_ids,
                reply_id,
                exc,
            )
            raise

    @staticmethod
    def _source_identity(
        reply: ReviewReply,
        photos: list,
    ) -> tuple:
        """Identify the reply version and exact stored photo collection being edited."""
        return (
            reply.REVW_ID_id,
            reply.RPLY_TEXT,
            reply.RPLY_UPDATED_AT,
            tuple(
                (
                    photo.RPHO_ID,
                    photo.RPHO_PHOTO_URL,
                    photo.RPHO_PHOTO_PUBLIC_ID,
                )
                for photo in photos
            ),
        )

    @staticmethod
    def _validate_photo_selection(
        existing_photos: list,
        keep_photo_ids: list | None,
        new_count: int,
    ) -> set:
        """Validate retained ownership and the final three-photo limit."""
        existing_ids = {
            photo.RPHO_ID
            for photo in existing_photos
        }
        if keep_photo_ids is None:
            keep_ids = existing_ids
        else:
            keep_ids = set(keep_photo_ids)
        if not keep_ids.issubset(existing_ids):
            raise ValidationError("One or more reply photos could not be found.")
        if len(keep_ids) + new_count > MAX_REVIEW_PHOTOS:
            raise ValidationError(
                f"You can only upload a maximum of {MAX_REVIEW_PHOTOS} photos.",
            )
        return keep_ids

    @staticmethod
    def _get_locked_reply(
        reply_id: int,
        review_id: int,
    ) -> ReviewReply:
        """Lock review then reply, matching creation and review deletion order."""
        try:
            Review.objects.select_for_update().get(pk=review_id)
            return (
                ReviewReply.objects
                .select_for_update(of=("self",))
                .select_related("REVW_ID__BUSN_ID")
                .get(
                    pk=reply_id,
                    REVW_ID_id=review_id,
                )
            )
        except (Review.DoesNotExist, ReviewReply.DoesNotExist):
            raise NotFound("The review reply could not be found.") from None

    @staticmethod
    def _compensate_uploads(
        public_ids: list[str],
        reply_id: int,
        request_error: Exception,
    ) -> None:
        """Confirm best-effort deletion of known unattached uploads without masking errors."""
        for public_id in dict.fromkeys(public_ids):
            context = {
                "operation": "update_reply",
                "reply_id": reply_id,
                "public_id": public_id,
                "request_error_type": type(request_error).__name__,
            }
            try:
                attached = (
                    ReplyPhoto.objects.filter(RPHO_PHOTO_PUBLIC_ID=public_id).exists()
                    or ReviewPhoto.objects.filter(RPHO_PHOTO_PUBLIC_ID=public_id).exists()
                )
            except Exception as exc:
                logger.error(
                    "Reply upload compensation skipped; attachment check failed.",
                    extra={**context, "error_type": type(exc).__name__},
                )
                continue
            if attached:
                logger.warning(
                    "Reply upload compensation skipped; asset is attached.",
                    extra=context,
                )
                continue
            try:
                result = CloudinaryService.destroy_asset(
                    public_id=public_id,
                    resource_type=ReviewMediaCleanup.ResourceType.IMAGE,
                )
                cleanup_result = result["result"]
            except Exception as exc:
                logger.error(
                    "Reply upload compensation failed; manual inspection required.",
                    extra={**context, "error_type": type(exc).__name__},
                )
                continue
            logger.info(
                "Reply upload compensation confirmed.",
                extra={**context, "cleanup_result": cleanup_result},
            )

    @staticmethod
    @transaction.atomic
    def delete_reply(
        user: User,
        reply_id: int,
    ) -> None:
        """Delete a reply and retain its media identifiers until cleanup succeeds."""
        reply = ReviewReplyService._get_reply(
            reply_id,
        )
        reply = ReviewReplyService._get_locked_reply(
            reply_id,
            reply.REVW_ID_id,
        )

        ReviewReplyService._ensure_owner(
            reply,
            user,
        )

        ReviewMediaCleanupService.register_assets(
            review_id=reply.REVW_ID_id,
            assets={
                (public_id, ReviewMediaCleanup.ResourceType.IMAGE)
                for public_id in reply.photos.values_list(
                    "RPHO_PHOTO_PUBLIC_ID",
                    flat=True,
                )
            },
        )

        reply.delete()

    @staticmethod
    @transaction.atomic
    def delete_photo(
        user: User,
        photo_id: int,
    ) -> None:
        """Remove a reply photo and register durable cleanup in the same transaction."""
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

        reply = ReviewReplyService._get_locked_reply(
            photo.RPLY_ID_id,
            photo.RPLY_ID.REVW_ID_id,
        )
        try:
            photo = ReplyPhoto.objects.get(
                pk=photo_id,
                RPLY_ID=reply,
            )
        except ReplyPhoto.DoesNotExist:
            raise NotFound("The reply photo could not be found.") from None

        ReviewReplyService._ensure_owner(
            reply,
            user,
        )

        ReviewMediaCleanupService.register_assets(
            review_id=reply.REVW_ID_id,
            assets={
                (
                    photo.RPHO_PHOTO_PUBLIC_ID,
                    ReviewMediaCleanup.ResourceType.IMAGE,
                ),
            },
        )

        photo.delete()
