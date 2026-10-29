"""Administrator queue and decisions for reviews held before publication."""

from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q, Subquery, TextField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.notifications.services.notification_event_service import NotificationEventService
from apps.reviews.models import Review, ReviewPhoto, ReviewReply
from apps.reviews.services.review_service import ReviewService


class ManageUnderReviewService:
    """Loads held reviews and applies audited, canonical decisions."""

    @staticmethod
    def queryset():
        """Load pending or manually moderated reviews with their latest decision."""
        decisions = (
            AdminActivity.objects
            .filter(AACT_ACTION__in=[
                AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                AdminActivity.Action.REVIEW_MODERATION_REJECTED,
            ])
            .annotate(
                review_id_text=KeyTextTransform("review_id", "AACT_CONTEXT"),
            )
            .filter(
                review_id_text=Cast(OuterRef("REVW_ID"), TextField()),
            )
            .order_by("-AACT_CREATED_AT", "-AACT_ID")
        )
        return (
            Review.objects
            .select_related("USER_ID", "BUSN_ID")
            .annotate(
                moderation_activity_id=Subquery(decisions.values("AACT_ID")[:1]),
                moderation_action=Subquery(decisions.values("AACT_ACTION")[:1]),
                has_reply=Exists(
                    ReviewReply.objects.filter(REVW_ID_id=OuterRef("pk"))
                ),
            )
            .filter(
                Q(REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW)
                | Q(moderation_activity_id__isnull=False)
            )
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

        status = filters.get("status", "pending")
        if status == "pending":
            queryset = queryset.filter(
                REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            )
        elif status in ("approved", "rejected"):
            if status == "approved":
                action = AdminActivity.Action.REVIEW_MODERATION_APPROVED
            else:
                action = AdminActivity.Action.REVIEW_MODERATION_REJECTED
            queryset = queryset.exclude(
                REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            ).filter(moderation_action=action)

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
        elif reason == "local_cebuano_safety":
            queryset = queryset.filter(
                REVW_MODERATION_DATA__findings__contains=[
                    {"source": "local_cebuano_safety", "flagged": True},
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
        """Return one pending or manually moderated review with its audit record."""
        try:
            review = (
                ManageUnderReviewService.queryset()
                .select_related("BUSN_ID__CTGRY_ID__CLUS_ID", "reply")
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The under-review review could not be found.") from None
        review.moderation_decision = None
        if (
            review.REVW_STATUS != Review.ReviewStatus.UNDER_REVIEW
            and review.moderation_activity_id
        ):
            review.moderation_decision = (
                AdminActivity.objects
                .select_related("ACTOR_ID")
                .get(pk=review.moderation_activity_id)
            )
        return review

    @staticmethod
    @transaction.atomic
    def resolve(
        review_id,
        *,
        actor,
        approve,
        moderation_notes=None,
    ):
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

        context = {
            "review_id": review.REVW_ID,
            "business_id": review.BUSN_ID_id,
            "previous_review_status": Review.ReviewStatus.UNDER_REVIEW,
        }

        if approve:
            resolved = ReviewService.publish_under_review(review_id)
            action = AdminActivity.Action.REVIEW_MODERATION_APPROVED
        else:
            if not isinstance(moderation_notes, str):
                raise ValidationError({
                    "moderation_notes": "Moderation notes are required.",
                })
            note = moderation_notes.strip()
            if len(note) < 20 or len(note) > 2000:
                raise ValidationError({
                    "moderation_notes": "Enter between 20 and 2000 characters.",
                })
            resolved = ReviewService.reject_under_review(review_id)
            resolved.REVW_MODERATION_NOTES = note
            resolved.save(update_fields=["REVW_MODERATION_NOTES"])
            action = AdminActivity.Action.REVIEW_MODERATION_REJECTED
            context["moderation_notes"] = note

        context["review_status"] = resolved.REVW_STATUS

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=review.USER_ID,
            action=action,
            context=context,
        )
        NotificationEventService.under_review_resolved(resolved)
        return resolved
