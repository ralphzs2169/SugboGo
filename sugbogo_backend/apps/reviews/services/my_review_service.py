from django.db.models import CharField, Count, Exists, OuterRef, Q, Subquery
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast

from apps.admin_operations.activity_management.models import AdminActivity
from apps.business.models import Business
from apps.business.services.display_cover_photo import (
    display_cover_photo_expression,
)
from apps.reviews.services.review_service import ReviewService
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.models import User


class MyReviewService:
    """Builds the authenticated author's retained cross-business review history."""

    @staticmethod
    def summarize_reviews(queryset):
        """Counts every retained submission before filtering or pagination."""
        return queryset.aggregate(
            total=Count("REVW_ID"),
            published=Count(
                "REVW_ID",
                filter=Q(REVW_STATUS="published"),
            ),
            under_review=Count(
                "REVW_ID",
                filter=Q(REVW_STATUS="under_review"),
            ),
            not_published=Count(
                "REVW_ID",
                filter=Q(REVW_STATUS__in=["flagged", "rejected"]),
            ),
        )

    @staticmethod
    def filter_and_sort_reviews(
        queryset,
        status,
        ordering,
    ):
        """Applies author-selected status and deterministic ordering before pagination."""
        if status == "not_published":
            queryset = queryset.filter(
                REVW_STATUS__in=["flagged", "rejected"],
            )
        elif status != "all":
            queryset = queryset.filter(REVW_STATUS=status)

        if ordering == "oldest":
            return queryset.order_by(
                "REVW_CREATED_AT",
                "REVW_ID",
            )
        return queryset.order_by(
            "-REVW_CREATED_AT",
            "-REVW_ID",
        )

    @staticmethod
    def list_reviews_queryset(
        user: User,
    ):
        """Return only the author's reviews without public visibility filters."""
        display_business = (
            Business.objects
            .filter(
                BUSN_ID=OuterRef("BUSN_ID_id"),
            )
            .annotate(
                display_cover_photo_url=display_cover_photo_expression(),
            )
            .values("display_cover_photo_url")[:1]
        )

        rejection_transition = (
            AdminActivity.objects
            .annotate(
                review_identity=KeyTextTransform("review_id", "AACT_CONTEXT"),
            )
            .filter(
                TARGET_USER_ID_id=OuterRef("USER_ID_id"),
                ACTOR_ID__USER_ROLE__in=[
                    User.UserRole.ADMIN,
                    User.UserRole.SUPER_ADMIN,
                ],
                review_identity=Cast(
                    OuterRef("REVW_ID"),
                    output_field=CharField(),
                ),
                AACT_ACTION__in=[
                    AdminActivity.Action.REVIEW_MODERATION_REJECTED,
                    AdminActivity.Action.REVIEW_REPORT_APPROVED,
                    AdminActivity.Action.REPORTED_REVIEW_REJECTED,
                    AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
                ],
                AACT_CONTEXT__previous_review_status__in=[
                    Review.ReviewStatus.PUBLISHED,
                    Review.ReviewStatus.UNDER_REVIEW,
                    Review.ReviewStatus.FLAGGED,
                ],
                AACT_CONTEXT__review_status=Review.ReviewStatus.REJECTED,
            )
            .order_by("-AACT_CREATED_AT", "-AACT_ID")
            .values("AACT_ACTION")[:1]
        )
        pending_disputes = MerchantReviewDispute.objects.filter(
            REVW_ID_id=OuterRef("REVW_ID"),
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        return (
            ReviewService._annotated_review_queryset(user)
            .filter(
                USER_ID=user,
            )
            .select_related(
                "BUSN_ID",
                "BUSN_ID__CTGRY_ID",
                "reply",
            )
            .annotate(
                my_review_display_cover_photo_url=Subquery(display_business),
                my_review_rejection_action=Subquery(rejection_transition),
                my_review_pending_dispute=Exists(pending_disputes),
            )
            .order_by(
                "-REVW_CREATED_AT",
                "-REVW_ID",
            )
        )
