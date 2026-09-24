import logging
from datetime import timedelta

from django.db import IntegrityError, models, transaction
from django.db.models import Avg, Count, Exists, OuterRef, Subquery
from django.db.models.functions import Greatest
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.business.models import Business, BusinessVouch
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.constants import MAX_REVIEW_PHOTOS
from apps.reviews.models import (
    Review,
    ReviewLike,
    ReviewPhoto,
)
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User
from apps.users.services.reputation_service import ReputationService

logger = logging.getLogger(__name__)


class ReviewService:
    """Handles creating, updating, and deleting business reviews."""

    OUTLIER_SENTIMENT_THRESHOLD = 0.8
    OUTLIER_MIN_PRIOR_REVIEWS = 5
    DEVICE_MAX_DISTINCT_USERS = 3
    DEVICE_MAX_REVIEWS_IN_WINDOW = 10
    DEVICE_REVIEW_WINDOW = timedelta(hours=24)

    @staticmethod
    def _queue_sentiment_after_commit(review_id: int, business_id: int) -> None:
        """Publishes sentiment work after commit without failing the review request."""

        def publish():
            try:
                from apps.reviews.tasks import process_review_sentiment

                process_review_sentiment.delay(review_id)
                logger.info(
                    "Review sentiment task queued.",
                    extra={"review_id": review_id, "business_id": business_id},
                )
            except Exception as exc:
                logger.error(
                    "Review sentiment task enqueue failed.",
                    extra={
                        "review_id": review_id,
                        "business_id": business_id,
                        "error_type": type(exc).__name__,
                    },
                )

        transaction.on_commit(publish, robust=True)

    @staticmethod
    def _is_outlier_sentiment(review: Review) -> bool:
        """Compare a scored review with the business's other published scores."""
        if review.REVW_SENTIMENT_SCORE is None:
            return False

        baseline = (
            Review.objects
            .filter(
                BUSN_ID_id=review.BUSN_ID_id,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                REVW_SENTIMENT_SCORE__isnull=False,
            )
            .exclude(pk=review.pk)
            .aggregate(
                count=Count("REVW_ID"),
                average=Avg("REVW_SENTIMENT_SCORE"),
            )
        )

        if baseline["count"] < ReviewService.OUTLIER_MIN_PRIOR_REVIEWS:
            return False

        return (
            abs(review.REVW_SENTIMENT_SCORE - baseline["average"])
            > ReviewService.OUTLIER_SENTIMENT_THRESHOLD
        )

    @staticmethod
    def _is_device_abuse(review: Review) -> bool:
        """Check the saved review's device for shared accounts or bulk posting."""
        device_id = review.REVW_DEVICE_ID
        if device_id is None or not device_id.strip():
            return False

        # Include every status so moderation cannot erase evidence of device use.
        device_reviews = Review.objects.filter(
            REVW_DEVICE_ID=device_id,
        )
        distinct_users = (
            device_reviews
            .filter(BUSN_ID_id=review.BUSN_ID_id)
            .values("USER_ID_id")
            .distinct()
            .count()
        )
        if distinct_users > ReviewService.DEVICE_MAX_DISTINCT_USERS:
            return True

        window_end = timezone.now()
        recent_count = device_reviews.filter(
            REVW_CREATED_AT__gte=window_end - ReviewService.DEVICE_REVIEW_WINDOW,
            REVW_CREATED_AT__lte=window_end,
        ).count()
        return recent_count > ReviewService.DEVICE_MAX_REVIEWS_IN_WINDOW

    @staticmethod
    @transaction.atomic
    def create_review(
        user: User,
        business_id: int,
        text: str,
        photos: list | None = None,
        device_id: str | None = None,
    ) -> Review:
        """Create a review and queue sentiment after its transaction commits."""
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

        if not isinstance(text, str) or not text.strip():
            raise ValidationError({"text": "Review text is required."})
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

        review.REVW_IS_DEVICE_ABUSE_FLAGGED = ReviewService._is_device_abuse(
            review,
        )
        review.save(
            update_fields=[
                "REVW_IS_DEVICE_ABUSE_FLAGGED",
                "REVW_UPDATED_AT",
            ],
        )

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

            if review.photos.exists():
                ReputationService.apply_review_with_photo_reward(
                    user_id=user.USER_ID,
                    source_id=review.REVW_ID,
                    business_id=business.BUSN_ID,
                )
            else:
                ReputationService.apply_review_reward(
                    user_id=user.USER_ID,
                    source_id=review.REVW_ID,
                    business_id=business.BUSN_ID,
                )

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        ReviewService._queue_sentiment_after_commit(
            review.REVW_ID,
            business.BUSN_ID,
        )
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

        active_disputes = (
            MerchantReviewDispute.objects
            .filter(
                REVW_ID=OuterRef("REVW_ID"),
                USER_ID=user,
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )
            .values("MRDSP_ID")[:1]
        )

        return (
            Review.objects
            .select_related("USER_ID")
            .annotate(
                is_liked=Exists(likes),
                is_liked_by_owner=Exists(owner_likes),
                is_own_review=Exists(own_reviews),
                active_dispute_id=Subquery(active_disputes),
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
        """Clear sentiment and queue rescoring only when review text changes."""
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

        had_photo_before_update = bool(
            existing_photos,
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

        text_changed = False

        try:
            if text is not None and text != review.REVW_TEXT:
                if not isinstance(text, str) or not text.strip():
                    raise ValidationError({"text": "Review text is required."})
                review.REVW_SENTIMENT_SCORE = None
                review.REVW_SENTIMENT_LABEL = None
                review.REVW_TEXT = text
                review.REVW_IS_OUTLIER_SENTIMENT = False
                text_changed = True

                review.save(
                    update_fields=[
                        "REVW_TEXT",
                        "REVW_SENTIMENT_SCORE",
                        "REVW_SENTIMENT_LABEL",
                        "REVW_IS_OUTLIER_SENTIMENT",
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

            if (
                new_photos
                and not had_photo_before_update
                and review.photos.exists()
            ):
                ReputationService.apply_review_photo_upgrade_reward(
                    user_id=user.USER_ID,
                    source_id=review.REVW_ID,
                    business_id=review.BUSN_ID_id,
                )

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        if text_changed:
            ReviewService._queue_sentiment_after_commit(
                review.REVW_ID,
                review.BUSN_ID_id,
            )
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
