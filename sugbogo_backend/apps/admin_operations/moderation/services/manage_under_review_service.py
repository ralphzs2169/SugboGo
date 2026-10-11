"""Administrator queue and decisions for reviews held before publication."""

from django.db import transaction
from django.db.models import Count, OuterRef, Q, Subquery
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_service import ReviewService


class ManageUnderReviewService:
    """Loads held reviews and applies audited, canonical decisions."""

    @staticmethod
    def queryset():
        """Load held reviews with their linked author and business."""
        return (
            Review.objects
            .select_related("USER_ID", "BUSN_ID")
            .filter(REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW)
        )

    @staticmethod
    def list_reviews(filters):
        """Return a filtered, oldest-first queue with stable pagination ties."""
        first_photo = (
            ReviewPhoto.objects
            .filter(REVW_ID_id=OuterRef("pk"))
            .order_by("RPHO_ID")
            .values("RPHO_PHOTO_URL")[:1]
        )
        queryset = ManageUnderReviewService.queryset().annotate(
            photo_count=Count("photos", distinct=True),
            first_photo_url=Subquery(first_photo),
        )

        search = filters.get("search")
        if search:
            queryset = queryset.filter(
                Q(REVW_TEXT__icontains=search)
                | Q(USER_ID__USER_FNAME__icontains=search)
                | Q(USER_ID__USER_LNAME__icontains=search)
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
            )

        reason = filters.get("reason")
        if reason == "text_flagged":
            queryset = queryset.filter(
                REVW_MODERATION_DATA__findings__contains=[
                    {"source": "text", "flagged": True},
                ],
            )
        elif reason == "image_flagged":
            queryset = queryset.filter(
                REVW_MODERATION_DATA__findings__contains=[
                    {"source": "image", "flagged": True},
                ],
            )
        elif reason == "provider_failure":
            queryset = queryset.filter(
                Q(REVW_MODERATION_DATA__outcome="provider_failure")
                | Q(REVW_MODERATION_DATA__incomplete=True)
            )

        content = filters.get("content")
        if content == "has_photos":
            queryset = queryset.filter(photo_count__gt=0)
        elif content == "text_only":
            queryset = queryset.filter(photo_count=0)

        if filters.get("ordering") == "newest":
            return queryset.order_by("-REVW_CREATED_AT", "-REVW_ID")
        return queryset.order_by("REVW_CREATED_AT", "REVW_ID")

    @staticmethod
    def get_review(review_id):
        """Return one held review or a controlled missing-resource error."""
        try:
            return ManageUnderReviewService.queryset().get(REVW_ID=review_id)
        except Review.DoesNotExist:
            raise NotFound("The under-review review could not be found.") from None

    @staticmethod
    @transaction.atomic
    def resolve(review_id, *, actor, approve):
        """Lock and resolve one held review with its AdminActivity record."""
        try:
            review = (
                Review.objects
                .select_for_update()
                .select_related("USER_ID")
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The under-review review could not be found.") from None

        if review.REVW_STATUS != Review.ReviewStatus.UNDER_REVIEW:
            raise ValidationError(
                "Only an under-review review can be resolved.",
            )

        if approve:
            resolved = ReviewService.publish_under_review(review_id)
            action = AdminActivity.Action.REVIEW_MODERATION_APPROVED
        else:
            resolved = ReviewService.reject_under_review(review_id)
            action = AdminActivity.Action.REVIEW_MODERATION_REJECTED

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=review.USER_ID,
            action=action,
            context={
                "review_id": review.REVW_ID,
                "business_id": review.BUSN_ID_id,
                "previous_review_status": Review.ReviewStatus.UNDER_REVIEW,
                "review_status": resolved.REVW_STATUS,
            },
        )
        return resolved
