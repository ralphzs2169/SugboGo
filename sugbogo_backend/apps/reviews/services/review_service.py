import logging
from datetime import timedelta

from django.db import IntegrityError, models, transaction
from django.db.models import Avg, Count, Exists, OuterRef, Q, Subquery
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
    BusinessReviewSummary,
    Review,
    ReviewLike,
    ReviewPhoto,
    ReviewReply,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_moderation_service import ReviewModerationService
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
    DUPLICATE_REVIEW_WINDOW = timedelta(days=30)
    DUPLICATE_PRIOR_MATCHES = 2

    @staticmethod
    def _queue_sentiment_after_commit(review_id: int, business_id: int) -> None:
        """Publishes sentiment work after commit without failing the review request."""

        def publish():
            try:
                from apps.reviews.tasks import process_review_sentiment

                process_review_sentiment.delay(
                    review_id,
                    business_id,
                )
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
    def _queue_review_insights_after_commit(business_id: int) -> None:
        """Publishes review-insight regeneration after a successful commit."""

        def publish():
            try:
                from apps.reviews.tasks import refresh_business_review_insights

                refresh_business_review_insights.delay(business_id)
                logger.info(
                    "Business review insights regeneration queued.",
                    extra={"business_id": business_id},
                )
            except Exception as exc:
                logger.error(
                    "Business review insights regeneration enqueue failed.",
                    extra={
                        "business_id": business_id,
                        "error_type": type(exc).__name__,
                    },
                )

        transaction.on_commit(publish, robust=True)

    @staticmethod
    def _queue_moderation_retry_after_commit(review_id: int) -> None:
        """Queue infrastructure recovery without changing submission success."""

        def publish():
            try:
                from apps.reviews.tasks import retry_failed_review_moderation

                retry_failed_review_moderation.delay(review_id)
                logger.info(
                    "Review moderation retry queued.",
                    extra={"review_id": review_id},
                )
            except Exception as exc:
                logger.error(
                    "Review moderation retry enqueue failed.",
                    extra={
                        "review_id": review_id,
                        "error_type": type(exc).__name__,
                    },
                )

        transaction.on_commit(publish, robust=True)

    @staticmethod
    def _apply_published_effects(review: Review) -> None:
        """Apply the count, reputation, and sentiment effects of publication."""
        Business.objects.filter(BUSN_ID=review.BUSN_ID_id).update(
            BUSN_REVIEW_COUNT=models.F("BUSN_REVIEW_COUNT") + 1,
        )

        if review.photos.exists():
            ReputationService.apply_review_with_photo_reward(
                user_id=review.USER_ID_id,
                source_id=review.REVW_ID,
                business_id=review.BUSN_ID_id,
            )
        else:
            ReputationService.apply_review_reward(
                user_id=review.USER_ID_id,
                source_id=review.REVW_ID,
                business_id=review.BUSN_ID_id,
            )

        ReviewService._queue_sentiment_after_commit(
            review.REVW_ID,
            review.BUSN_ID_id,
        )

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
        """Check the installation for shared accounts or bulk posting."""
        return bool(ReviewService._installation_reliability_reasons(review))

    @staticmethod
    def _installation_reliability_reasons(review: Review) -> list[str]:
        """Return distinct installation signals without changing publication."""
        installation_id = review.REVW_INSTALLATION_ID
        if installation_id is None or not installation_id.strip():
            return []

        # Include every status so moderation cannot erase installation evidence.
        installation_reviews = Review.objects.filter(
            REVW_INSTALLATION_ID=installation_id,
        )
        reasons = []
        distinct_users = (
            installation_reviews
            .filter(BUSN_ID_id=review.BUSN_ID_id)
            .values("USER_ID_id")
            .distinct()
            .count()
        )
        if distinct_users > ReviewService.DEVICE_MAX_DISTINCT_USERS:
            reasons.append(
                Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS,
            )

        window_end = timezone.now()
        recent_count = installation_reviews.filter(
            REVW_CREATED_AT__gte=window_end - ReviewService.DEVICE_REVIEW_WINDOW,
            REVW_CREATED_AT__lte=window_end,
        ).count()
        if recent_count > ReviewService.DEVICE_MAX_REVIEWS_IN_WINDOW:
            reasons.append(Review.ReliabilityReason.RAPID_SUBMISSION)

        return reasons

    @staticmethod
    def _has_duplicate_content(review: Review) -> bool:
        """Find two prior normalized matches from the author or installation."""
        normalized_text = " ".join(review.REVW_TEXT.split()).casefold()
        window_end = timezone.now()
        source_filter = Q(USER_ID_id=review.USER_ID_id)
        installation_id = review.REVW_INSTALLATION_ID
        if installation_id is not None and installation_id.strip():
            source_filter |= Q(REVW_INSTALLATION_ID=installation_id)

        prior_texts = (
            Review.objects
            .filter(
                source_filter,
                REVW_CREATED_AT__gte=(
                    window_end - ReviewService.DUPLICATE_REVIEW_WINDOW
                ),
                REVW_CREATED_AT__lte=window_end,
            )
            .exclude(pk=review.pk)
            .exclude(BUSN_ID_id=review.BUSN_ID_id)
            .values_list("REVW_TEXT", flat=True)
            .iterator()
        )
        match_count = 0
        for prior_text in prior_texts:
            if " ".join(prior_text.split()).casefold() == normalized_text:
                match_count += 1
                if match_count >= ReviewService.DUPLICATE_PRIOR_MATCHES:
                    return True

        return False

    @staticmethod
    def _reliability_reasons(review: Review) -> list[str]:
        """Evaluate the three advisory signals in a stable stored order."""
        reasons = ReviewService._installation_reliability_reasons(review)
        if ReviewService._has_duplicate_content(review):
            reasons.append(Review.ReliabilityReason.DUPLICATE_CONTENT)
        return reasons

    @staticmethod
    def create_review(
        user: User,
        business_id: int,
        text: str,
        photos: list | None = None,
        installation_id: str | None = None,
    ) -> Review:
        """Moderate before atomically creating a published or held review."""
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

        if Review.objects.filter(USER_ID=user, BUSN_ID=business).exists():
            raise ValidationError(
                "You have already reviewed this business.",
            )

        submitted_photos = photos or []
        moderation = ReviewModerationService.moderate(
            text=text,
            photos=submitted_photos,
        )
        moderation["retry_attempt"] = 0
        moderation["retryable"] = moderation["outcome"] == "provider_failure"
        moderation["retry_exhausted"] = False
        moderation["last_attempted_at"] = moderation["checked_at"]
        moderation["last_provider_failure"] = moderation["failure_type"]
        review_status = Review.ReviewStatus.PUBLISHED
        if moderation["outcome"] != "safe":
            review_status = Review.ReviewStatus.UNDER_REVIEW

        uploaded_public_ids = []
        uploaded_photos = []

        try:
            for photo in submitted_photos:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/reviews",
                )
                public_id = upload_result["public_id"]
                uploaded_public_ids.append(public_id)
                uploaded_photos.append(upload_result)

            with transaction.atomic():
                try:
                    review = Review.objects.create(
                        USER_ID=user,
                        BUSN_ID=business,
                        REVW_TEXT=text,
                        REVW_INSTALLATION_ID=installation_id,
                        REVW_STATUS=review_status,
                    )
                except IntegrityError:
                    raise ValidationError(
                        "You have already reviewed this business.",
                    ) from None

                for index, upload_result in enumerate(uploaded_photos):
                    review_photo = ReviewPhoto.objects.create(
                        REVW_ID=review,
                        RPHO_PHOTO_URL=upload_result["secure_url"],
                        RPHO_PHOTO_PUBLIC_ID=upload_result["public_id"],
                    )
                    for finding in moderation["findings"]:
                        if finding["photo_index"] == index:
                            finding["photo_id"] = review_photo.RPHO_ID

                review.REVW_MODERATION_DATA = moderation
                try:
                    with transaction.atomic():
                        reliability_reasons = ReviewService._reliability_reasons(
                            review,
                        )
                except Exception as exc:
                    logger.error(
                        "Review reliability evaluation failed.",
                        extra={
                            "review_id": review.REVW_ID,
                            "error_type": type(exc).__name__,
                        },
                    )
                    reliability_reasons = []

                review.REVW_RELIABILITY_REASONS = reliability_reasons
                installation_reasons = {
                    Review.ReliabilityReason.RAPID_SUBMISSION,
                    Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS,
                }
                review.REVW_IS_DEVICE_ABUSE_FLAGGED = bool(
                    installation_reasons.intersection(reliability_reasons)
                )
                review.save(
                    update_fields=[
                        "REVW_MODERATION_DATA",
                        "REVW_RELIABILITY_REASONS",
                        "REVW_IS_DEVICE_ABUSE_FLAGGED",
                        "REVW_UPDATED_AT",
                    ],
                )

                if review_status == Review.ReviewStatus.PUBLISHED:
                    ReviewService._apply_published_effects(review)
                elif moderation["outcome"] == "provider_failure":
                    ReviewService._queue_moderation_retry_after_commit(
                        review.REVW_ID,
                    )

        except Exception:
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(
                    public_id,
                )

            raise

        logger.info(
            "Review creation moderation decision saved.",
            extra={
                "review_id": review.REVW_ID,
                "outcome": moderation["outcome"],
                "review_status": review_status,
            },
        )
        return review

    @staticmethod
    def _get_review(
        review_id: int,
    ) -> Review:
        try:
            return (
                Review.objects
                .select_for_update()
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
            .order_by("-REVW_CREATED_AT", "-REVW_ID")
        )

    @staticmethod
    def get_review_detail(review_id: int, user: User) -> Review:
        """Fetch a single review through the same annotation/attachment path
        used for listing, so the serializer's is_own_review and
        vouched_specialties fields are always populated."""

        try:
            review = ReviewService._annotated_review_queryset(user).get(
                models.Q(REVW_STATUS=Review.ReviewStatus.PUBLISHED)
                | models.Q(USER_ID=user),
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
        """Return a bounded public preview and the current user's review."""
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

        # Get the first 2 reviews for the business, ordered by creation date (most recent first).
        reviews = ReviewService._get_review_queryset(
            business_id,
            user,
        )[:2]

        user_review = (
            ReviewService._annotated_review_queryset(user)
            .filter(
                BUSN_ID_id=business_id,
                USER_ID=user,
            )
            .first()
        )

        if user_review is not None:
            ReviewService._attach_vouched_specialties([user_review])

        return {
            "reviews": ReviewService._attach_vouched_specialties(
                reviews,
            ),
            "total_count": total_count,
            "user_review": user_review,
        }

    @staticmethod
    def list_reviews_queryset(
        business_id: int,
        user: User,
        sentiment: str | None = None,
        has_photos: bool = False,
        merchant_replied: bool = False,
        topic: str | None = None,
        ordering: str | None = None,
    ):
        """Build a filterable and deterministically ordered review queryset."""
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

        if sentiment is not None:
            reviews = reviews.filter(REVW_SENTIMENT_LABEL=sentiment)

        if has_photos:
            photos = ReviewPhoto.objects.filter(
                REVW_ID_id=OuterRef("pk"),
            )
            reviews = reviews.filter(Exists(photos))

        if merchant_replied:
            replies = ReviewReply.objects.filter(
                REVW_ID_id=OuterRef("pk"),
            )
            reviews = reviews.filter(Exists(replies))

        if topic is not None:
            tags = (
                BusinessReviewSummary.objects
                .filter(BUSN_ID_id=business_id)
                .values_list("BRSU_KEYWORD_TAGS", flat=True)
                .first()
            )
            normalized_topic = " ".join(topic.split()).casefold()
            supporting_ids = []

            if isinstance(tags, list):
                for tag in tags:
                    if not isinstance(tag, dict):
                        continue
                    label = tag.get("text")
                    if (
                        isinstance(label, str)
                        and " ".join(label.split()).casefold() == normalized_topic
                    ):
                        evidence = tag.get("review_ids")
                        if isinstance(evidence, list):
                            supporting_ids = [
                                review_id
                                for review_id in evidence
                                if type(review_id) is int
                            ]
                        break

            eligible_ids = (
                BusinessReviewSummaryService.eligible_reviews(business_id)
                .filter(REVW_ID__in=supporting_ids)
                .values("REVW_ID")
            )
            reviews = reviews.filter(REVW_ID__in=eligible_ids)

        ordering_fields = {
            "newest": ("-REVW_CREATED_AT", "-REVW_ID"),
            "oldest": ("REVW_CREATED_AT", "REVW_ID"),
            "most_liked": ("-REVW_LIKE_COUNT", "-REVW_CREATED_AT", "-REVW_ID"),
        }
        reviews = reviews.order_by(
            *ordering_fields.get(
                ordering,
                ordering_fields["newest"],
            ),
        )

        return reviews

    @staticmethod
    def list_reviews(
        business_id: int,
        user: User,
        sentiment: str | None = None,
        has_photos: bool = False,
        merchant_replied: bool = False,
        topic: str | None = None,
        ordering: str | None = None,
    ):
        """List reviews with attached vouches for existing service callers."""
        reviews = ReviewService.list_reviews_queryset(
            business_id=business_id,
            user=user,
            sentiment=sentiment,
            has_photos=has_photos,
            merchant_replied=merchant_replied,
            topic=topic,
            ordering=ordering,
        )

        return ReviewService._attach_vouched_specialties(reviews)

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

        if review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError(
                "This review cannot be edited while it is under review.",
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
            BusinessReviewSummaryService.recompute_sentiment(
                review.BUSN_ID_id,
            )
            ReviewKeywordService.remove_review_evidence(
                business_id=review.BUSN_ID_id,
                review_id=review.REVW_ID,
            )
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
        """Delete a review and immediately refresh its business sentiment summary."""
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

        deleted_review_id = review.REVW_ID
        business_id = review.BUSN_ID_id

        was_published = review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
        review.delete()

        if was_published:
            Business.objects.filter(
                BUSN_ID=business_id,
            ).update(
                BUSN_REVIEW_COUNT=Greatest(
                    models.F("BUSN_REVIEW_COUNT") - 1,
                    0,
                ),
            )

        BusinessReviewSummaryService.recompute_sentiment(
            business_id,
        )
        ReviewKeywordService.remove_review_evidence(
            business_id=business_id,
            review_id=deleted_review_id,
        )
        ReviewService._queue_review_insights_after_commit(
            business_id,
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
                .select_for_update()
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

        if photo.REVW_ID.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError(
                "This review cannot be edited while it is under review.",
            )

        CloudinaryService.delete_image(
            photo.RPHO_PHOTO_PUBLIC_ID,
        )

        photo.delete()

    @staticmethod
    @transaction.atomic
    def publish_under_review(review_id: int) -> Review:
        """Publish a held review and start its existing publication effects."""
        try:
            review = (
                Review.objects
                .select_for_update()
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None

        if review.REVW_STATUS != Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError("Only an under-review review can be published.")

        review.REVW_STATUS = Review.ReviewStatus.PUBLISHED
        review.save(update_fields=["REVW_STATUS", "REVW_UPDATED_AT"])

        ReviewService._apply_published_effects(review)
        ReviewService._queue_review_insights_after_commit(
            review.BUSN_ID_id,
        )
        return review

    @staticmethod
    @transaction.atomic
    def reject_under_review(review_id: int) -> Review:
        """Reject a held review and remove any generated evidence."""
        try:
            review = Review.objects.select_for_update().get(REVW_ID=review_id)
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None

        if review.REVW_STATUS != Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError("Only an under-review review can be rejected.")

        from apps.reviews.services.review_moderation_consistency_service import (
            ReviewModerationConsistencyService,
        )

        review, _ = ReviewModerationConsistencyService.reject_review(
            review.REVW_ID,
        )
        return review
