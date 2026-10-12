"""Admin-only review reliability investigation responses."""

from rest_framework import serializers

from apps.reviews.models import Review
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)


class SuspiciousReviewFilterSerializer(serializers.Serializer):
    """Validate the queue's search, signal, and sort options."""

    search = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    signal = serializers.ChoiceField(
        choices=Review.ReliabilityReason.values,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest"),
        required=False,
    )


class SuspiciousReviewListSerializer(serializers.ModelSerializer):
    """Serialize only compact queue context, without raw evidence."""

    id = serializers.IntegerField(source="REVW_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    text_preview = serializers.SerializerMethodField()
    first_photo_url = serializers.URLField(read_only=True, allow_null=True)
    photo_count = serializers.IntegerField(read_only=True)
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT")
    reasons = serializers.ListField(source="REVW_RELIABILITY_REASONS")

    class Meta:
        model = Review
        fields = (
            "id",
            "author",
            "business",
            "text_preview",
            "first_photo_url",
            "photo_count",
            "submitted_at",
            "reasons",
        )

    def get_business(self, review):
        """Return the linked business identity."""
        return {
            "id": review.BUSN_ID_id,
            "name": review.BUSN_ID.BUSN_NAME,
        }

    def get_text_preview(self, review):
        """Keep queue content short."""
        return review.REVW_TEXT[:160]


class RelatedReviewSerializer(serializers.ModelSerializer):
    """Show currently retained related review context to Admins."""

    id = serializers.IntegerField(source="REVW_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT")
    status = serializers.CharField(source="REVW_STATUS")
    text = serializers.CharField(source="REVW_TEXT")

    class Meta:
        model = Review
        fields = ("id", "author", "business", "submitted_at", "status", "text")

    def get_business(self, review):
        """Return the related review's business identity."""
        return {
            "id": review.BUSN_ID_id,
            "name": review.BUSN_ID.BUSN_NAME,
        }


class SuspiciousReviewDetailSerializer(serializers.ModelSerializer):
    """Keep stored detection evidence distinct from live related records."""

    id = serializers.IntegerField(source="REVW_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    text = serializers.CharField(source="REVW_TEXT")
    photos = ReviewPhotoResponseSerializer(many=True)
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT")
    status = serializers.CharField(source="REVW_STATUS")
    reasons = serializers.ListField(source="REVW_RELIABILITY_REASONS")
    detection_evidence = serializers.SerializerMethodField()
    current_related_activity = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "author",
            "business",
            "text",
            "photos",
            "submitted_at",
            "status",
            "reasons",
            "detection_evidence",
            "current_related_activity",
        )

    def get_business(self, review):
        """Return the linked business identity."""
        return {
            "id": review.BUSN_ID_id,
            "name": review.BUSN_ID.BUSN_NAME,
        }

    def get_detection_evidence(self, review):
        """Return the immutable snapshot with deleted match availability."""
        evidence = review.REVW_RELIABILITY_EVIDENCE
        if not isinstance(evidence, dict):
            return {}
        duplicate = evidence.get(Review.ReliabilityReason.DUPLICATE_CONTENT)
        if not isinstance(duplicate, dict):
            return evidence
        matched_ids = duplicate.get("matched_review_ids", [])
        retained_ids = set(
            Review.objects
            .filter(pk__in=matched_ids)
            .values_list("REVW_ID", flat=True)
        )
        return {
            **evidence,
            Review.ReliabilityReason.DUPLICATE_CONTENT: {
                **duplicate,
                "matched_reviews": [
                    {"id": review_id, "available": review_id in retained_ids}
                    for review_id in matched_ids
                ],
            },
        }

    def get_current_related_activity(self, review):
        """Serialize live relationships separately from stored evidence."""
        related = self.context.get("related_reviews", {})
        activity = {}
        for reason, reviews in related.items():
            activity[reason] = {
                "reviews": RelatedReviewSerializer(reviews, many=True).data,
                "review_count": len(reviews),
            }
            if reason == Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS:
                activity[reason]["distinct_account_count"] = len({
                    item.USER_ID_id
                    for item in reviews
                })
        evidence = review.REVW_RELIABILITY_EVIDENCE
        if isinstance(evidence, dict):
            duplicate = evidence.get(Review.ReliabilityReason.DUPLICATE_CONTENT)
            if isinstance(duplicate, dict):
                matched_ids = duplicate.get("matched_review_ids", [])
                referenced = (
                    Review.objects
                    .select_related("USER_ID", "BUSN_ID")
                    .filter(pk__in=matched_ids)
                )
                activity["referenced_reviews"] = RelatedReviewSerializer(
                    referenced,
                    many=True,
                ).data
        return activity
