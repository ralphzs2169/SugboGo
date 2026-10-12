"""Review-grouped, read-only queries for pending community reports."""

from django.db.models import Count, Exists, Max, Min, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Concat
from rest_framework.exceptions import NotFound

from apps.reviews.models import Review, ReviewPhoto, ReviewReply, ReviewReport


class ReportedReviewService:
    """Group pending reports by review before filtering and pagination."""

    @staticmethod
    def queryset():
        """Include any review with a pending report, including rejected reviews."""
        pending = Q(reports__RREP_STATUS=ReviewReport.ReportStatus.PENDING)
        pending_exists = ReviewReport.objects.filter(
            REVW_ID_id=OuterRef("pk"),
            RREP_STATUS=ReviewReport.ReportStatus.PENDING,
        )
        reply_exists = ReviewReply.objects.filter(REVW_ID_id=OuterRef("pk"))
        first_photo = (
            ReviewPhoto.objects
            .filter(REVW_ID_id=OuterRef("pk"))
            .order_by("RPHO_ID")
            .values("RPHO_PHOTO_URL")[:1]
        )
        return (
            Review.objects
            .select_related("USER_ID", "BUSN_ID")
            .annotate(has_pending_reports=Exists(pending_exists))
            .filter(has_pending_reports=True)
            .annotate(
                pending_report_count=Count(
                    "reports",
                    filter=pending,
                    distinct=True,
                ),
                spam_count=Count(
                    "reports",
                    filter=pending & Q(reports__RREP_TYPE=ReviewReport.ReportType.SPAM),
                    distinct=True,
                ),
                abuse_count=Count(
                    "reports",
                    filter=pending & Q(reports__RREP_TYPE=ReviewReport.ReportType.ABUSE),
                    distinct=True,
                ),
                misinformation_count=Count(
                    "reports",
                    filter=pending & Q(
                        reports__RREP_TYPE=ReviewReport.ReportType.MISINFORMATION,
                    ),
                    distinct=True,
                ),
                other_count=Count(
                    "reports",
                    filter=pending & Q(reports__RREP_TYPE=ReviewReport.ReportType.OTHER),
                    distinct=True,
                ),
                first_pending_at=Min("reports__RREP_CREATED_AT", filter=pending),
                latest_pending_at=Max("reports__RREP_CREATED_AT", filter=pending),
                photo_count=Count("photos", distinct=True),
                first_photo_url=Subquery(first_photo),
                has_reply=Exists(reply_exists),
            )
        )

    @staticmethod
    def list_reviews(filters):
        """Filter and order review groups before pagination."""
        queryset = ReportedReviewService.queryset()
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
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
            )

        reason = filters.get("reason")
        if reason:
            matching_report = ReviewReport.objects.filter(
                REVW_ID_id=OuterRef("pk"),
                RREP_STATUS=ReviewReport.ReportStatus.PENDING,
                RREP_TYPE=reason,
            )
            queryset = queryset.annotate(
                has_matching_reason=Exists(matching_report),
            ).filter(has_matching_reason=True)

        ordering = filters.get("ordering")
        if ordering == "oldest":
            return queryset.order_by("first_pending_at", "REVW_ID")
        if ordering == "newest":
            return queryset.order_by("-latest_pending_at", "-REVW_ID")
        return queryset.order_by(
            "-pending_report_count",
            "first_pending_at",
            "REVW_ID",
        )

    @staticmethod
    def get_review(review_id):
        """Load one active report group and its individual report records."""
        reports = ReviewReport.objects.order_by(
            "RREP_STATUS",
            "RREP_CREATED_AT",
            "RREP_ID",
        )
        try:
            return (
                ReportedReviewService.queryset()
                .select_related(
                    "BUSN_ID__CTGRY_ID__CLUS_ID",
                    "reply",
                )
                .prefetch_related(
                    "photos",
                    Prefetch("reports", queryset=reports, to_attr="investigation_reports"),
                )
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The reported review could not be found.") from None
