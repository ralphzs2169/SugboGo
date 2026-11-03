"""Read-only directory queries across the complete retained review inventory."""

from datetime import datetime, time, timedelta

from django.db.models import (
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce, Concat
from rest_framework.exceptions import NotFound

from apps.admin_operations.activity_management.models import AdminActivity
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewPhoto, ReviewReport
from apps.shared.analytics.date_ranges import MANILA


REVIEW_DECISION_ACTIONS = (
    AdminActivity.Action.REVIEW_MODERATION_APPROVED,
    AdminActivity.Action.REVIEW_MODERATION_REJECTED,
    AdminActivity.Action.REVIEW_REPORT_APPROVED,
    AdminActivity.Action.REVIEW_REPORT_REJECTED,
    AdminActivity.Action.REPORTED_REVIEW_KEPT,
    AdminActivity.Action.REPORTED_REVIEW_REJECTED,
    AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
    AdminActivity.Action.REVIEW_DISPUTE_DISMISSED,
)


class AllReviewService:
    """Load directory summaries and inspection data without changing review state."""

    @staticmethod
    def get_summary():
        """Count retained reviews once, including overlapping reported statuses."""
        reports = ReviewReport.objects.filter(REVW_ID_id=OuterRef("pk"))
        return (
            Review.objects
            .annotate(has_reports=Exists(reports))
            .aggregate(
                total_reviews=Count("pk"),
                published=Count(
                    "pk",
                    filter=Q(REVW_STATUS=Review.ReviewStatus.PUBLISHED),
                ),
                under_review=Count(
                    "pk",
                    filter=Q(REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW),
                ),
                reported=Count(
                    "pk",
                    filter=Q(has_reports=True),
                ),
            )
        )

    @staticmethod
    def queryset():
        """Load identities and scalar media/report summaries without multiplying rows."""
        photos = ReviewPhoto.objects.filter(REVW_ID_id=OuterRef("pk"))
        reports = ReviewReport.objects.filter(REVW_ID_id=OuterRef("pk"))
        photo_counts = (
            photos.order_by()
            .values("REVW_ID")
            .annotate(total=Count("pk"))
            .values("total")
        )
        report_counts = (
            reports.order_by()
            .values("REVW_ID")
            .annotate(
                total=Count("pk"),
                pending=Count(
                    "pk",
                    filter=Q(RREP_STATUS=ReviewReport.ReportStatus.PENDING),
                ),
            )
        )
        return (
            Review.objects
            .select_related("USER_ID", "BUSN_ID__CTGRY_ID__CLUS_ID")
            .annotate(
                has_reports=Exists(reports),
                report_count=Coalesce(
                    Subquery(report_counts.values("total")),
                    0,
                    output_field=IntegerField(),
                ),
                pending_report_count=Coalesce(
                    Subquery(report_counts.values("pending")),
                    0,
                    output_field=IntegerField(),
                ),
                photo_count=Coalesce(
                    Subquery(photo_counts),
                    0,
                    output_field=IntegerField(),
                ),
                first_photo_url=Subquery(
                    photos.order_by("RPHO_ID").values("RPHO_PHOTO_URL")[:1],
                ),
            )
        )

    @staticmethod
    def list_reviews(filters):
        """Apply validated directory filters and stable submission ordering in SQL."""
        queryset = AllReviewService.queryset().defer(
            "REVW_MODERATION_DATA",
            "REVW_MODERATION_NOTES",
            "REVW_RELIABILITY_EVIDENCE",
            "REVW_RELIABILITY_REASONS",
            "REVW_INSTALLATION_ID",
        )
        search = filters.get("search")
        if search:
            queryset = queryset.annotate(
                author_name=Concat(
                    "USER_ID__USER_FNAME",
                    Value(" "),
                    "USER_ID__USER_LNAME",
                ),
            ).filter(
                Q(REVW_TEXT__icontains=search)
                | Q(USER_ID__USER_FNAME__icontains=search)
                | Q(USER_ID__USER_LNAME__icontains=search)
                | Q(author_name__icontains=search)
                | Q(USER_ID__USER_EMAIL__icontains=search)
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
            )

        status = filters.get("status")
        if status:
            queryset = queryset.filter(REVW_STATUS=status)
        if "reported" in filters:
            queryset = queryset.filter(has_reports=filters["reported"])

        start_date = filters.get("start_date")
        if start_date:
            queryset = queryset.filter(
                REVW_CREATED_AT__gte=datetime.combine(
                    start_date,
                    time.min,
                    tzinfo=MANILA,
                ),
            )
        end_date = filters.get("end_date")
        if end_date:
            queryset = queryset.filter(
                REVW_CREATED_AT__lt=datetime.combine(
                    end_date + timedelta(days=1),
                    time.min,
                    tzinfo=MANILA,
                ),
            )

        if filters.get("ordering") == "oldest":
            return queryset.order_by("REVW_CREATED_AT", "REVW_ID")
        return queryset.order_by("-REVW_CREATED_AT", "-REVW_ID")

    @staticmethod
    def get_review(review_id):
        """Load any retained review, ordered media/reports, and existing decisions."""
        active_disputes = MerchantReviewDispute.objects.filter(
            REVW_ID_id=OuterRef("pk"),
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING,
        ).values("MRDSP_ID")[:1]
        try:
            review = (
                AllReviewService.queryset()
                .annotate(active_dispute_id=Subquery(active_disputes))
                .prefetch_related(
                    Prefetch(
                        "photos",
                        queryset=ReviewPhoto.objects.order_by("RPHO_ID"),
                    ),
                    Prefetch(
                        "reports",
                        queryset=ReviewReport.objects.order_by(
                            "-RREP_CREATED_AT",
                            "-RREP_ID",
                        ),
                    ),
                )
                .get(pk=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The review could not be found.") from None

        review.review_history = list(
            AdminActivity.objects
            .select_related("ACTOR_ID")
            .filter(
                AACT_ACTION__in=REVIEW_DECISION_ACTIONS,
                AACT_CONTEXT__review_id=review.pk,
            )
            .order_by("-AACT_CREATED_AT", "-AACT_ID"),
        )
        return review
