"""Read-only queries for Admin reliability investigations."""

from django.db.models import Count, OuterRef, Q, Subquery, Value
from django.db.models.functions import Concat
from rest_framework.exceptions import NotFound

from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_service import ReviewService


class SuspiciousReviewService:
    """Load published advisory signals and current related activity."""

    @staticmethod
    def queryset():
        """Limit the investigation queue to published reviews with signals."""
        return (
            Review.objects
            .select_related("USER_ID", "BUSN_ID")
            .filter(REVW_STATUS=Review.ReviewStatus.PUBLISHED)
            .exclude(REVW_RELIABILITY_REASONS=[])
        )

    @staticmethod
    def list_reviews(filters):
        """Filter the queue before stable server-side pagination."""
        first_photo = (
            ReviewPhoto.objects
            .filter(REVW_ID_id=OuterRef("pk"))
            .order_by("RPHO_ID")
            .values("RPHO_PHOTO_URL")[:1]
        )
        queryset = SuspiciousReviewService.queryset().annotate(
            photo_count=Count("photos", distinct=True),
            first_photo_url=Subquery(first_photo),
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
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
            )
        signal = filters.get("signal")
        if signal:
            queryset = queryset.filter(
                REVW_RELIABILITY_REASONS__contains=[signal],
            )
        if filters.get("ordering") == "oldest":
            return queryset.order_by("REVW_CREATED_AT", "REVW_ID")
        return queryset.order_by("-REVW_CREATED_AT", "-REVW_ID")

    @staticmethod
    def get_review(review_id):
        """Find an active suspicious review or return a controlled 404."""
        try:
            return (
                SuspiciousReviewService.queryset()
                .prefetch_related("photos")
                .get(REVW_ID=review_id)
            )
        except Review.DoesNotExist:
            raise NotFound("The suspicious review could not be found.") from None

    @staticmethod
    def related_reviews(review):
        """Query retained records using the original review's relationships."""
        reasons = set(review.REVW_RELIABILITY_REASONS)
        installation_id = review.REVW_INSTALLATION_ID
        has_installation = bool(installation_id and installation_id.strip())
        related = {}

        if Review.ReliabilityReason.DUPLICATE_CONTENT in reasons:
            source_filter = Q(USER_ID_id=review.USER_ID_id)
            if has_installation:
                source_filter |= Q(REVW_INSTALLATION_ID=installation_id)
            candidates = (
                Review.objects
                .select_related("USER_ID", "BUSN_ID")
                .filter(
                    source_filter,
                    REVW_CREATED_AT__gte=(
                        review.REVW_CREATED_AT - ReviewService.DUPLICATE_REVIEW_WINDOW
                    ),
                    REVW_CREATED_AT__lte=review.REVW_CREATED_AT,
                )
                .exclude(pk=review.pk)
                .exclude(BUSN_ID_id=review.BUSN_ID_id)
                .order_by("-REVW_CREATED_AT", "-REVW_ID")
            )
            normalized_text = " ".join(review.REVW_TEXT.split()).casefold()
            related[Review.ReliabilityReason.DUPLICATE_CONTENT] = [
                candidate
                for candidate in candidates
                if " ".join(candidate.REVW_TEXT.split()).casefold()
                == normalized_text
            ]

        if (
            has_installation
            and Review.ReliabilityReason.RAPID_SUBMISSION in reasons
        ):
            related[Review.ReliabilityReason.RAPID_SUBMISSION] = list(
                Review.objects
                .select_related("USER_ID", "BUSN_ID")
                .filter(
                    REVW_INSTALLATION_ID=installation_id,
                    REVW_CREATED_AT__gte=(
                        review.REVW_CREATED_AT - ReviewService.DEVICE_REVIEW_WINDOW
                    ),
                    REVW_CREATED_AT__lte=review.REVW_CREATED_AT,
                )
                .order_by("-REVW_CREATED_AT", "-REVW_ID")
            )

        if (
            has_installation
            and Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS in reasons
        ):
            related[Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS] = list(
                Review.objects
                .select_related("USER_ID", "BUSN_ID")
                .filter(
                    REVW_INSTALLATION_ID=installation_id,
                    BUSN_ID_id=review.BUSN_ID_id,
                )
                .order_by("-REVW_CREATED_AT", "-REVW_ID")
            )
        return related
