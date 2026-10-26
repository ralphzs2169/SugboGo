import logging
from copy import deepcopy
from datetime import timedelta
from hashlib import blake2b

from django.db import IntegrityError, connection, models, transaction
from django.db.models import Avg, Count, Exists, OuterRef, Q, Subquery
from django.db.models.functions import Greatest
from django.utils import timezone
from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.notifications.services.notification_event_service import NotificationEventService
from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.constants import MAX_REVIEW_PHOTOS
from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewLike,
    ReviewMediaCleanup,
    ReviewPhoto,
    ReviewReport,
    ReviewReply,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_insight_scheduling_service import ReviewInsightSchedulingService
from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.review_moderation_service import ReviewModerationService
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_reply_eligibility import actionable_unanswered_reviews
from apps.shared.services.cloudinary_service import CloudinaryService
from apps.users.models import User
from apps.users.services.reputation_service import ReputationService

logger = logging.getLogger(__name__)


class ReviewEditContentFlagged(APIException):
    status_code = 400
    default_detail = "Your changes did not pass the content safety check."
    default_code = "REVIEW_EDIT_CONTENT_FLAGGED"


class ReviewEditModerationUnavailable(APIException):
    status_code = 503
    default_detail = "The content check could not be completed. Please try again later."
    default_code = "REVIEW_EDIT_MODERATION_UNAVAILABLE"


class ReviewEditConflict(APIException):
    status_code = 409
    default_detail = "This review changed while you were editing. Reload it and try again."
    default_code = "REVIEW_EDIT_CONFLICT"


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
    def _lock_reliability_creation_keys(
        user_id: int,
        installation_id: str | None,
    ) -> None:
        """Serialize overlapping review creations before detection queries run."""
        if connection.vendor != "postgresql":
            return

        keys = [f"review-reliability:user:{user_id}"]
        if installation_id is not None and installation_id.strip():
            keys.append(f"review-reliability:installation:{installation_id}")

        # Stable, ordered keys avoid process-local mutexes and lock-order deadlocks.
        lock_ids = sorted(
            int.from_bytes(
                blake2b(key.encode("utf-8"), digest_size=8).digest(),
                byteorder="big",
                signed=True,
            )
            for key in keys
        )
        with connection.cursor() as cursor:
            for lock_id in lock_ids:
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(%s)",
                    [lock_id],
                )

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
    def _queue_review_insights_after_commit(
        business_id: int,
    ) -> None:
        """Keep old internal callers on idempotent durable reconciliation."""
        ReviewInsightSchedulingService.reconcile(business_id)

    @staticmethod
    def _queue_moderation_retry_after_commit(review_id: int) -> None:
        """Dispatch durable initial or retry moderation after its owning commit."""

        def publish():
            try:
                from apps.reviews.tasks import retry_failed_review_moderation

                retry_failed_review_moderation.delay(review_id)
                logger.info(
                    "Review moderation work queued.",
                    extra={"review_id": review_id},
                )
            except Exception as exc:
                logger.error(
                    "Review moderation enqueue failed; durable work remains recoverable.",
                    extra={
                        "review_id": review_id,
                        "error_type": type(exc).__name__,
                    },
                )

        transaction.on_commit(publish, robust=True)

    @staticmethod
    def _apply_published_effects(review: Review) -> None:
        """Apply owner notification, count, reputation, and sentiment publication effects."""
        if review.REVW_PUBLISHED_AT is None:
            review.REVW_PUBLISHED_AT = timezone.now()
            review.save(update_fields=["REVW_PUBLISHED_AT"])
        NotificationEventService.business_review_received(review)
        # Match report decisions: lock the reputation account before the
        # business counter, then acquire insight policy and demand locks.
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

        Business.objects.filter(BUSN_ID=review.BUSN_ID_id).update(
            BUSN_REVIEW_COUNT=models.F("BUSN_REVIEW_COUNT") + 1,
        )

        ReviewService._queue_sentiment_after_commit(
            review.REVW_ID,
            review.BUSN_ID_id,
        )
        ReviewInsightSchedulingService.review_changed(
            review.BUSN_ID_id,
            None,
            ReviewInsightSchedulingService.review_input(review),
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
        reasons, _ = ReviewService._installation_reliability_findings(review)
        return reasons

    @staticmethod
    def _installation_reliability_findings(review: Review) -> tuple[list[str], dict]:
        """Capture installation signal decisions and their detection-time counts."""
        installation_id = review.REVW_INSTALLATION_ID
        if installation_id is None or not installation_id.strip():
            return [], {}

        # Include every status so moderation cannot erase installation evidence.
        installation_reviews = Review.objects.filter(
            REVW_INSTALLATION_ID=installation_id,
        )
        reasons = []
        evidence = {}
        observed_at = timezone.now()
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
            evidence[Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS] = {
                "observed_at": observed_at.isoformat(),
                "distinct_account_count": distinct_users,
            }

        window_end = observed_at
        recent_count = installation_reviews.filter(
            REVW_CREATED_AT__gte=window_end - ReviewService.DEVICE_REVIEW_WINDOW,
            REVW_CREATED_AT__lte=window_end,
        ).count()
        if recent_count > ReviewService.DEVICE_MAX_REVIEWS_IN_WINDOW:
            reasons.append(Review.ReliabilityReason.RAPID_SUBMISSION)
            evidence[Review.ReliabilityReason.RAPID_SUBMISSION] = {
                "observed_at": observed_at.isoformat(),
                "window_hours": int(
                    ReviewService.DEVICE_REVIEW_WINDOW.total_seconds() / 3600
                ),
                "review_count": recent_count,
            }

        return reasons, evidence

    @staticmethod
    def _has_duplicate_content(review: Review) -> bool:
        """Find two prior normalized matches from the author or installation."""
        return ReviewService._duplicate_content_evidence(review) is not None

    @staticmethod
    def _duplicate_content_evidence(review: Review) -> dict | None:
        """Capture exact prior matches from the duplicate decision query."""
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
            .values("REVW_ID", "REVW_TEXT", "USER_ID_id")
            .iterator()
        )
        matched_ids = []
        same_user_matches = 0
        for prior in prior_texts:
            if " ".join(prior["REVW_TEXT"].split()).casefold() == normalized_text:
                matched_ids.append(prior["REVW_ID"])
                if prior["USER_ID_id"] == review.USER_ID_id:
                    same_user_matches += 1

        if len(matched_ids) < ReviewService.DUPLICATE_PRIOR_MATCHES:
            return None

        if same_user_matches == len(matched_ids):
            basis = "same_user"
        elif same_user_matches == 0:
            basis = "same_installation"
        else:
            basis = "same_user_or_installation"

        return {
            "observed_at": window_end.isoformat(),
            "prior_match_count": len(matched_ids),
            "matched_review_ids": matched_ids,
            "basis": basis,
        }

    @staticmethod
    def _reliability_reasons(review: Review) -> tuple[list[str], dict]:
        """Evaluate advisory signals and capture their supporting evidence."""
        reasons, evidence = ReviewService._installation_reliability_findings(review)
        duplicate_evidence = ReviewService._duplicate_content_evidence(review)
        if duplicate_evidence is not None:
            reasons.append(Review.ReliabilityReason.DUPLICATE_CONTENT)
            evidence[Review.ReliabilityReason.DUPLICATE_CONTENT] = duplicate_evidence
        return reasons, evidence

    @staticmethod
    def _record_edit_duplicate_content(review: Review) -> None:
        """Append a first edit-time duplicate finding without rewriting history."""
        duplicate_reason = Review.ReliabilityReason.DUPLICATE_CONTENT
        reasons = review.REVW_RELIABILITY_REASONS
        if duplicate_reason in reasons:
            return

        duplicate_evidence = ReviewService._duplicate_content_evidence(review)
        if duplicate_evidence is None:
            return

        evidence = review.REVW_RELIABILITY_EVIDENCE.copy()
        duplicate_evidence["detected_during"] = "edit"
        evidence[duplicate_reason] = duplicate_evidence
        original_reasons = review.REVW_RELIABILITY_REASONS
        original_evidence = review.REVW_RELIABILITY_EVIDENCE
        review.REVW_RELIABILITY_REASONS = [
            *reasons,
            duplicate_reason,
        ]
        review.REVW_RELIABILITY_EVIDENCE = evidence
        try:
            review.save(
                update_fields=[
                    "REVW_RELIABILITY_REASONS",
                    "REVW_RELIABILITY_EVIDENCE",
                    "REVW_UPDATED_AT",
                ],
            )
        except Exception:
            review.REVW_RELIABILITY_REASONS = original_reasons
            review.REVW_RELIABILITY_EVIDENCE = original_evidence
            raise

    @staticmethod
    def create_review(
        user: User,
        business_id: int,
        text: str,
        photos: list | None = None,
        installation_id: str | None = None,
        show_in_community: bool = True,
    ) -> Review:
        """Upload and save a private review before dispatching stored-content moderation."""
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
                from apps.reviews.services.review_moderation_retry_service import (
                    ReviewModerationRetryService,
                )

                ReviewService._lock_reliability_creation_keys(
                    user.USER_ID,
                    installation_id,
                )
                initial_moderation = ReviewModerationRetryService.initial_metadata()
                try:
                    review = Review.objects.create(
                        USER_ID=user,
                        BUSN_ID=business,
                        REVW_TEXT=text,
                        REVW_INSTALLATION_ID=installation_id,
                        REVW_SHOW_IN_COMMUNITY=show_in_community,
                        REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
                        REVW_MODERATION_DATA=initial_moderation,
                    )
                except IntegrityError:
                    raise ValidationError(
                        "You have already reviewed this business.",
                    ) from None

                for upload_result in uploaded_photos:
                    ReviewPhoto.objects.create(
                        REVW_ID=review,
                        RPHO_PHOTO_URL=upload_result["secure_url"],
                        RPHO_PHOTO_PUBLIC_ID=upload_result["public_id"],
                    )

                try:
                    with transaction.atomic():
                        (
                            reliability_reasons,
                            reliability_evidence,
                        ) = ReviewService._reliability_reasons(review)
                    reliability_check_outcome = (
                        Review.ReliabilityCheckOutcome.CHECKED
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
                    reliability_evidence = {}
                    reliability_check_outcome = (
                        Review.ReliabilityCheckOutcome.UNAVAILABLE
                    )

                review.REVW_RELIABILITY_REASONS = reliability_reasons
                review.REVW_RELIABILITY_EVIDENCE = reliability_evidence
                review.REVW_RELIABILITY_CHECK_OUTCOME = reliability_check_outcome
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
                        "REVW_RELIABILITY_EVIDENCE",
                        "REVW_RELIABILITY_CHECK_OUTCOME",
                        "REVW_IS_DEVICE_ABUSE_FLAGGED",
                        "REVW_UPDATED_AT",
                    ],
                )

                ReviewService._queue_moderation_retry_after_commit(
                    review.REVW_ID,
                )

        except Exception as exc:
            ReviewService._compensate_uploaded_photos(
                public_ids=uploaded_public_ids,
                operation="create",
                business_id=business_id,
                review_id=None,
                request_error=exc,
            )
            raise

        logger.info(
            "Review saved for initial moderation.",
            extra={
                "review_id": review.REVW_ID,
                "outcome": review.REVW_MODERATION_DATA["outcome"],
                "review_status": review.REVW_STATUS,
            },
        )
        return review

    @staticmethod
    def _compensate_uploaded_photos(
        public_ids: list[str],
        operation: str,
        business_id: int,
        review_id: int | None,
        request_error: Exception,
    ) -> None:
        """Compensate known request uploads without deleting referenced review photos."""
        for public_id in dict.fromkeys(public_ids):
            context = {
                "operation": operation,
                "business_id": business_id,
                "review_id": review_id,
                "public_id": public_id,
                "request_error_type": type(request_error).__name__,
            }
            try:
                attached = ReviewPhoto.objects.filter(
                    RPHO_PHOTO_PUBLIC_ID=public_id,
                ).exists()
            except Exception as exc:
                logger.error(
                    "Review upload compensation skipped; attachment check failed.",
                    extra={
                        **context,
                        "cleanup_stage": "attachment_check",
                        "error_type": type(exc).__name__,
                    },
                )
                continue

            if attached:
                logger.warning(
                    "Review upload compensation skipped; asset is attached.",
                    extra=context,
                )
                continue

            try:
                result = ReviewMediaCleanupService.destroy_unretained_asset(
                    public_id=public_id,
                    resource_type=ReviewMediaCleanup.ResourceType.IMAGE,
                )
                cleanup_result = result["result"]
            except Exception as exc:
                logger.error(
                    "Review upload compensation failed; manual inspection required.",
                    extra={
                        **context,
                        "cleanup_stage": "deletion",
                        "error_type": type(exc).__name__,
                    },
                )
                continue

            logger.info(
                "Review upload compensation confirmed.",
                extra={
                    **context,
                    "cleanup_result": cleanup_result,
                },
            )

    @staticmethod
    def _get_review(
        review_id: int,
    ) -> Review:
        try:
            return (
                Review.objects
                .select_for_update(of=("self",))
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

        own_reports = ReviewReport.objects.filter(
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
            BusinessReviewSummaryService.annotate_sentiment_source(
                Review.objects.all(),
                user,
            )
            .select_related("USER_ID")
            .annotate(
                is_liked=Exists(likes),
                is_liked_by_owner=Exists(owner_likes),
                is_own_review=Exists(own_reviews),
                has_reported=Exists(own_reports),
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
        """Attach each author's vouches for active business specialties."""

        reviews = list(
            reviews,
        )

        if not reviews:
            return reviews

        business_ids = {
            review.BUSN_ID_id
            for review in reviews
        }
        user_ids = {
            review.USER_ID_id
            for review in reviews
        }

        active_specialties = BusinessSpecialtyTag.objects.filter(
            BUSN_ID_id=OuterRef("BUSN_ID_id"),
            TAG_ID_id=OuterRef("TAG_ID_id"),
            BST_IS_ACTIVE=True,
        )

        vouches = (
            BusinessVouch.objects
            .filter(
                VOUCH_WITHDRAWN_AT__isnull=True,
                BUSN_ID_id__in=business_ids,
                USER_ID__in=user_ids,
            )
            .filter(Exists(active_specialties))
            .select_related(
                "TAG_ID",
            )
        )

        vouches_by_business_and_user = {}

        for vouch in vouches:
            vouches_by_business_and_user.setdefault(
                (
                    vouch.BUSN_ID_id,
                    vouch.USER_ID_id,
                ),
                [],
            ).append(
                vouch,
            )

        for review in reviews:
            review.vouched_specialties = vouches_by_business_and_user.get(
                (
                    review.BUSN_ID_id,
                    review.USER_ID_id,
                ),
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
        needs_reply: bool = False,
    ):
        """Build a filterable and deterministically ordered review queryset."""
        try:
            business = Business.objects.get(
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

        if needs_reply:
            if (
                user.USER_ROLE != User.UserRole.MERCHANT
                or business.USER_ID_id != user.USER_ID
            ):
                raise PermissionDenied(
                    "You can only manage unanswered reviews for your own business.",
                )
            if merchant_replied:
                raise ValidationError(
                    {
                        "needs_reply": (
                            "Cannot combine needs_reply with merchant_replied=true."
                        ),
                    },
                )
            pending = actionable_unanswered_reviews(
                business_id,
                timezone.now(),
            )
            reviews = reviews.filter(
                REVW_ID__in=pending.order_by().values("REVW_ID"),
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
        needs_reply: bool = False,
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
            needs_reply=needs_reply,
        )

        return ReviewService._attach_vouched_specialties(reviews)

    @staticmethod
    def update_review(
        user: User,
        review_id: int,
        text: str | None = None,
        photos: list | None = None,
        keep_photo_ids: list | None = None,
        show_in_community: bool | None = None,
    ) -> Review:
        """Moderate a proposed edit before changing its published content."""
        try:
            source = Review.objects.get(REVW_ID=review_id)
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None

        if source.USER_ID_id != user.USER_ID:
            raise PermissionDenied("You do not have permission to update this review.")
        if source.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError("This review cannot be edited while it is under review.")

        existing_photos = list(source.photos.all().order_by("RPHO_ID"))
        source_identity = ReviewService._edit_source_identity(source, existing_photos)
        existing_ids = {photo.RPHO_ID for photo in existing_photos}
        if keep_photo_ids is None:
            keep_ids = existing_ids
        else:
            keep_ids = set(keep_photo_ids)
        if not keep_ids.issubset(existing_ids):
            raise ValidationError("One or more review photos could not be found.")

        new_photos = photos or []
        if len(keep_ids) + len(new_photos) > MAX_REVIEW_PHOTOS:
            raise ValidationError(
                f"You can only upload a maximum of {MAX_REVIEW_PHOTOS} photos.",
            )

        proposed_text = source.REVW_TEXT if text is None else text
        if not isinstance(proposed_text, str) or not proposed_text.strip():
            raise ValidationError({"text": "Review text is required."})

        retained_photos = [
            photo
            for photo in existing_photos
            if photo.RPHO_ID in keep_ids
        ]
        moderation = None
        if proposed_text != source.REVW_TEXT or new_photos:
            try:
                moderation = ReviewModerationService.moderate(
                    text=proposed_text,
                    photos=new_photos,
                    image_urls=[
                        photo.RPHO_PHOTO_URL
                        for photo in retained_photos
                    ],
                )
            except Exception as exc:
                logger.warning(
                    "Review edit moderation could not be completed.",
                    extra={
                        "review_id": review_id,
                        "error_type": type(exc).__name__,
                    },
                )
                raise ReviewEditModerationUnavailable() from None

            if (
                not isinstance(moderation, dict)
                or not isinstance(moderation.get("findings"), list)
            ):
                raise ReviewEditModerationUnavailable()
            if moderation.get("outcome") == "flagged":
                raise ReviewEditContentFlagged()
            if (
                moderation.get("incomplete") is True
                or moderation.get("outcome") != "safe"
            ):
                raise ReviewEditModerationUnavailable()

        uploaded_public_ids = []
        uploaded_photos = []
        try:
            for photo in new_photos:
                upload_result = CloudinaryService.upload_image(
                    photo,
                    folder="sugbogo/reviews",
                )
                uploaded_public_ids.append(upload_result["public_id"])
                uploaded_photos.append(upload_result)

            return ReviewService._save_review_update(
                user=user,
                review_id=review_id,
                text=text,
                photos=new_photos,
                keep_photo_ids=keep_photo_ids,
                show_in_community=show_in_community,
                source_identity=source_identity,
                uploaded_photos=uploaded_photos,
                moderation=moderation,
            )
        except Exception as exc:
            ReviewService._compensate_uploaded_photos(
                public_ids=uploaded_public_ids,
                operation="update",
                business_id=source.BUSN_ID_id,
                review_id=review_id,
                request_error=exc,
            )
            raise

    @staticmethod
    def _edit_source_identity(review: Review, photos: list) -> tuple:
        """Identify the source content and status across the provider call."""
        return (
            review.REVW_STATUS,
            review.REVW_TEXT,
            review.REVW_SHOW_IN_COMMUNITY,
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
    def _reconcile_removed_photo_findings(
        review: Review,
        retained_ids: set[int],
    ) -> None:
        """Remove findings for deleted images without claiming another AI check."""
        metadata = review.REVW_MODERATION_DATA
        if not isinstance(metadata, dict):
            return
        findings = metadata.get("findings")
        if not isinstance(findings, list):
            return

        updated = deepcopy(metadata)
        updated["findings"] = [
            finding
            for finding in findings
            if not isinstance(finding, dict)
            or finding.get("source") != "image"
            or finding.get("photo_id") in retained_ids
        ]
        updated["image_count"] = len(retained_ids)
        if updated == metadata:
            return
        review.REVW_MODERATION_DATA = updated
        review.save(update_fields=["REVW_MODERATION_DATA", "REVW_UPDATED_AT"])

    @staticmethod
    @transaction.atomic
    def _save_review_update(
        user: User,
        review_id: int,
        text: str | None,
        photos: list,
        keep_photo_ids: list | None,
        show_in_community: bool | None,
        source_identity: tuple,
        uploaded_photos: list,
        moderation: dict | None,
    ) -> Review:
        """Apply accepted edit effects under a lock after checking its source."""
        review = ReviewService._get_review(
            review_id,
        )

        if review.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to update this review.",
            )

        existing_photos = list(review.photos.all().order_by("RPHO_ID"))
        if ReviewService._edit_source_identity(review, existing_photos) != source_identity:
            raise ReviewEditConflict()

        if review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError(
                "This review cannot be edited while it is under review.",
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

        removed_photos = [
            photo
            for photo in existing_photos
            if photo.RPHO_ID not in keep_ids
        ]
        retained_photos = [
            photo
            for photo in existing_photos
            if photo.RPHO_ID in keep_ids
        ]

        text_changed = False
        previous_input = ReviewInsightSchedulingService.review_input(review)
        previous_normalized_text = review.REVW_TEXT.strip()

        if show_in_community is not None and (
            show_in_community != review.REVW_SHOW_IN_COMMUNITY
        ):
            review.REVW_SHOW_IN_COMMUNITY = show_in_community
            review.save(
                update_fields=["REVW_SHOW_IN_COMMUNITY", "REVW_UPDATED_AT"],
            )

        if text is not None and text != review.REVW_TEXT:
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

        created_photos = []
        for upload in uploaded_photos:
            created_photos.append(
                ReviewPhoto.objects.create(
                    REVW_ID=review,
                    RPHO_PHOTO_URL=upload["secure_url"],
                    RPHO_PHOTO_PUBLIC_ID=upload["public_id"],
                ),
            )

        if removed_photos:
            ReviewMediaCleanupService.register_assets(
                review_id=review.pk,
                assets={
                    (
                        photo.RPHO_PHOTO_PUBLIC_ID,
                        ReviewMediaCleanup.ResourceType.IMAGE,
                    )
                    for photo in removed_photos
                },
            )
            ReviewPhoto.objects.filter(
                RPHO_ID__in=[
                    photo.RPHO_ID
                    for photo in removed_photos
                ],
            ).delete()

        if moderation is not None:
            accepted_moderation = deepcopy(moderation)
            assessed_photos = [*created_photos, *retained_photos]
            for finding in accepted_moderation["findings"]:
                if not isinstance(finding, dict):
                    raise ReviewEditModerationUnavailable()
                if finding.get("source") != "image":
                    continue
                index = finding.get("photo_index")
                if not isinstance(index, int) or not 0 <= index < len(assessed_photos):
                    raise ReviewEditModerationUnavailable()
                finding["photo_id"] = assessed_photos[index].RPHO_ID
            accepted_moderation["image_count"] = len(assessed_photos)
            accepted_moderation["retryable"] = False
            accepted_moderation["retry_exhausted"] = False
            accepted_moderation["retry_attempt"] = 0
            accepted_moderation["last_attempted_at"] = accepted_moderation.get(
                "checked_at",
            )
            review.REVW_MODERATION_DATA = accepted_moderation
            review.save(update_fields=["REVW_MODERATION_DATA", "REVW_UPDATED_AT"])
        elif removed_photos:
            ReviewService._reconcile_removed_photo_findings(
                review,
                {photo.RPHO_ID for photo in retained_photos},
            )

        if text_changed or uploaded_photos or removed_photos:
            review.REVW_EDITED_AT = timezone.now()
            review.save(update_fields=["REVW_EDITED_AT"])

        if (
            review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
            and uploaded_photos
            and not had_photo_before_update
        ):
            ReputationService.apply_review_photo_upgrade_reward(
                user_id=user.USER_ID,
                source_id=review.REVW_ID,
                business_id=review.BUSN_ID_id,
            )

        if text_changed:
            ReviewInsightSchedulingService.review_changed(
                review.BUSN_ID_id,
                previous_input,
                ReviewInsightSchedulingService.review_input(review),
            )
            if (
                previous_input is None
                and previous_normalized_text != review.REVW_TEXT.strip()
            ):
                ReviewKeywordService.remove_review_evidence(
                    review.BUSN_ID_id,
                    review.REVW_ID,
                )
            duplicate_already_recorded = (
                Review.ReliabilityReason.DUPLICATE_CONTENT
                in review.REVW_RELIABILITY_REASONS
            )
            try:
                with transaction.atomic():
                    ReviewService._record_edit_duplicate_content(review)
                    if not duplicate_already_recorded:
                        review.REVW_RELIABILITY_CHECK_OUTCOME = (
                            Review.ReliabilityCheckOutcome.CHECKED
                        )
                        review.save(
                            update_fields=["REVW_RELIABILITY_CHECK_OUTCOME"],
                        )
            except Exception as exc:
                logger.error(
                    "Review edit duplicate reliability evaluation failed.",
                    extra={
                        "review_id": review.REVW_ID,
                        "error_type": type(exc).__name__,
                    },
                )
                review.REVW_RELIABILITY_CHECK_OUTCOME = (
                    Review.ReliabilityCheckOutcome.UNAVAILABLE
                )
                review.save(
                    update_fields=["REVW_RELIABILITY_CHECK_OUTCOME"],
                )
            BusinessReviewSummaryService.recompute_sentiment(
                review.BUSN_ID_id,
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
        """Audit removal, notify pending cases, and hard-delete the review atomically."""
        review = ReviewService._get_review(
            review_id,
        )

        if review.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to delete this review.",
            )

        ReviewService._record_author_deletion(
            review=review,
            actor=user,
        )

        ReviewMediaCleanupService.register_review_assets(review)

        business_id = review.BUSN_ID_id
        deleted_review_id = review.REVW_ID

        was_published = review.REVW_STATUS == Review.ReviewStatus.PUBLISHED
        previous_input = ReviewInsightSchedulingService.review_input(review)
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

        ReviewInsightSchedulingService.review_changed(
            business_id,
            previous_input,
            None,
        )
        if previous_input is None:
            ReviewKeywordService.remove_review_evidence(
                business_id,
                deleted_review_id,
            )
        BusinessReviewSummaryService.recompute_sentiment(
            business_id,
        )

    @staticmethod
    def _record_author_deletion(
        review: Review,
        actor: User,
    ) -> None:
        """Audit removal and notify submitters from the same locked case snapshot."""
        pending_reports = list(
            ReviewReport.objects
            .select_for_update(of=("self",))
            .filter(
                REVW_ID_id=review.pk,
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
            )
            .order_by("RREP_ID")
            .values("RREP_ID", "RREP_STATUS", "USER_ID_id")
        )
        pending_disputes = list(
            MerchantReviewDispute.objects
            .select_for_update(of=("self",))
            .filter(
                REVW_ID_id=review.pk,
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
            )
            .order_by("MRDSP_ID")
            .values("MRDSP_ID", "MRDSP_STATUS", "USER_ID_id")
        )
        context = {
            "review_id": review.pk,
            "author_id": review.USER_ID_id,
            "business_id": review.BUSN_ID_id,
            "previous_review_status": review.REVW_STATUS,
            "closure_reason": "content_removed_by_author",
            "pending_reports": [
                {
                    "id": report["RREP_ID"],
                    "previous_status": report["RREP_STATUS"],
                }
                for report in pending_reports
            ],
            "pending_disputes": [
                {
                    "id": dispute["MRDSP_ID"],
                    "previous_status": dispute["MRDSP_STATUS"],
                }
                for dispute in pending_disputes
            ],
        }
        if (
            review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW
            and isinstance(review.REVW_MODERATION_DATA, dict)
        ):
            outcome = review.REVW_MODERATION_DATA.get("outcome")
            if outcome in ("flagged", "provider_failure"):
                context["ai_moderation_outcome"] = outcome

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=actor,
            action=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            context=context,
        )
        NotificationEventService.review_cases_closed_by_author(
            author_id=review.USER_ID_id,
            pending_reports=pending_reports,
            pending_disputes=pending_disputes,
            business_name=review.BUSN_ID.BUSN_NAME,
        )
        MerchantReviewDispute.objects.filter(
            MRDSP_ID__in=[
                dispute["MRDSP_ID"]
                for dispute in pending_disputes
            ],
        ).update(
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.AUTHOR_DELETED,
            MRDSP_CLOSURE_REASON="content_removed_by_author",
            MRDSP_RESOLVED_AT=timezone.now(),
            MRDSP_UPDATED_AT=timezone.now(),
        )

    @staticmethod
    @transaction.atomic
    def delete_photo(
        user: User,
        photo_id: int,
    ) -> None:
        """Remove an author's photo while retaining durable cleanup intent until success."""
        review_id = (
            ReviewPhoto.objects
            .filter(RPHO_ID=photo_id)
            .values_list("REVW_ID_id", flat=True)
            .first()
        )
        if review_id is None:
            raise NotFound(
                "The review photo could not be found.",
            )

        review = ReviewService._get_review(review_id)
        photo = (
            ReviewPhoto.objects
            .select_for_update()
            .filter(RPHO_ID=photo_id, REVW_ID_id=review_id)
            .first()
        )
        if photo is None:
            raise NotFound("The review photo could not be found.")

        if review.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to delete this review photo.",
            )

        if review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError(
                "This review cannot be edited while it is under review.",
            )

        ReviewMediaCleanupService.register_assets(
            review_id=review.pk,
            assets={
                (
                    photo.RPHO_PHOTO_PUBLIC_ID,
                    ReviewMediaCleanup.ResourceType.IMAGE,
                ),
            },
        )
        photo.delete()
        ReviewService._reconcile_removed_photo_findings(
            review,
            set(review.photos.values_list("RPHO_ID", flat=True)),
        )

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
