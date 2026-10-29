"""Admin-only review moderation input and structured evidence responses."""

from rest_framework import serializers

from apps.admin_operations.activity_management.models import AdminActivity
from apps.reviews.models import Review, ReviewReply
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyResponseSerializer,
)


def moderation_data(review):
    """Return the stored moderation mapping without exposing it directly."""
    data = review.REVW_MODERATION_DATA
    return data if isinstance(data, dict) else {}


def moderation_findings(review):
    """Return only recognizable per-input moderation findings."""
    findings = moderation_data(review).get("findings", [])
    if not isinstance(findings, list):
        return []
    return [item for item in findings if isinstance(item, dict)]


def flagged_categories(finding):
    """Extract provider categories positively flagged for one input."""
    categories = finding.get("categories")
    if not isinstance(categories, dict):
        return []
    return [key for key, flagged in categories.items() if flagged is True]


class AdminUnderReviewFilterSerializer(serializers.Serializer):
    """Validate supported Admin queue filters and ordering."""

    search = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    status = serializers.ChoiceField(
        choices=("pending", "approved", "rejected", "all"),
        required=False,
        default="pending",
    )
    reason = serializers.ChoiceField(
        choices=(
            "text_flagged",
            "image_flagged",
            "local_cebuano_safety",
            "provider_failure",
        ),
        required=False,
    )
    content = serializers.ChoiceField(
        choices=("has_photos", "text_only"),
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=("oldest", "newest"),
        required=False,
    )


class AdminUnderReviewRejectSerializer(serializers.Serializer):
    """Require an internal explanation for a human rejection decision."""

    moderation_notes = serializers.CharField(
        min_length=20,
        max_length=2000,
        trim_whitespace=True,
    )


class AdminUnderReviewListSerializer(serializers.ModelSerializer):
    """Serialize only the details needed to scan the held-review queue."""

    id = serializers.IntegerField(source="REVW_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    text_preview = serializers.SerializerMethodField()
    first_photo_url = serializers.URLField(read_only=True, allow_null=True)
    photo_count = serializers.IntegerField(read_only=True)
    has_reply = serializers.BooleanField(read_only=True)
    is_edited = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(source="REVW_CREATED_AT")
    status = serializers.CharField(source="REVW_STATUS")
    hold_reasons = serializers.SerializerMethodField()
    decision_status = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "author",
            "business",
            "text_preview",
            "first_photo_url",
            "photo_count",
            "has_reply",
            "is_edited",
            "submitted_at",
            "status",
            "hold_reasons",
            "decision_status",
        )

    def get_decision_status(self, review):
        """Expose the manual decision separately from the current review status."""
        if review.REVW_STATUS == Review.ReviewStatus.UNDER_REVIEW:
            return "pending"
        if review.moderation_action == AdminActivity.Action.REVIEW_MODERATION_APPROVED:
            return "approved"
        return "rejected"

    def get_business(self, review):
        """Return a small linked business identity."""
        return {
            "id": review.BUSN_ID_id,
            "name": review.BUSN_ID.BUSN_NAME,
        }

    def get_text_preview(self, review):
        """Keep queue text short without changing canonical review text."""
        return review.REVW_TEXT[:160]

    def get_is_edited(self, review):
        """Only a recorded author edit counts as an edited review."""
        return review.REVW_EDITED_AT is not None

    def get_hold_reasons(self, review):
        """Summarize which inputs or provider failures require inspection."""
        reasons = []
        findings = moderation_findings(review)
        if any(
            item.get("source") == "text" and item.get("flagged") is True
            for item in findings
        ):
            reasons.append("text_flagged")
        if any(
            item.get("source") == "image" and item.get("flagged") is True
            for item in findings
        ):
            reasons.append("image_flagged")
        if any(
            item.get("source") == "local_cebuano_safety"
            and item.get("flagged") is True
            for item in findings
        ):
            reasons.append("local_cebuano_safety")
        data = moderation_data(review)
        if data.get("outcome") == "provider_failure" or data.get("incomplete") is True:
            reasons.append("provider_failure")
        return reasons


class AdminUnderReviewDetailSerializer(AdminUnderReviewListSerializer):
    """Serialize held content and per-input findings for human moderation."""

    text = serializers.CharField(source="REVW_TEXT")
    photos = serializers.SerializerMethodField()
    moderation = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(source="REVW_LIKE_COUNT")
    reliability_check_outcome = serializers.CharField(
        source="REVW_RELIABILITY_CHECK_OUTCOME"
    )
    edited_at = serializers.DateTimeField(
        source="REVW_EDITED_AT",
        allow_null=True,
    )
    reply = serializers.SerializerMethodField()
    decision = serializers.SerializerMethodField()

    class Meta(AdminUnderReviewListSerializer.Meta):
        fields = AdminUnderReviewListSerializer.Meta.fields + (
            "text",
            "photos",
            "moderation",
            "like_count",
            "reliability_check_outcome",
            "edited_at",
            "reply",
            "decision",
        )

    def get_decision(self, review):
        """Return the recorded reviewer, decision time, and original internal notes."""
        activity = review.moderation_decision
        if activity is None:
            return None
        actor = activity.ACTOR_ID
        return {
            "status": self.get_decision_status(review),
            "reviewed_by": {
                "id": actor.pk,
                "first_name": actor.USER_FNAME,
                "last_name": actor.USER_LNAME,
            },
            "reviewed_at": activity.AACT_CREATED_AT,
            "notes": activity.AACT_CONTEXT.get("moderation_notes"),
        }

    def get_reply(self, review):
        """Expose an existing merchant reply only inside Admin detail."""
        try:
            reply = review.reply
        except ReviewReply.DoesNotExist:
            return None
        return ReviewReplyResponseSerializer(reply).data

    def get_business(self, review):
        """Include the linked business cover and classification for Admin context."""
        business = review.BUSN_ID
        category = business.CTGRY_ID
        cluster = category.CLUS_ID

        return {
            "id": review.BUSN_ID_id,
            "name": business.BUSN_NAME,
            "cover_photo_url": business.BUSN_COVER_PHOTO_URL,
            "cluster_name": cluster.CLUS_NAME,
            "category_name": category.CTGRY_NAME,
        }

    def get_photos(self, review):
        """Pair each persisted image with its own moderation categories."""
        findings = moderation_findings(review)
        photos = list(review.photos.all().order_by("RPHO_ID"))
        serialized = ReviewPhotoResponseSerializer(photos, many=True).data
        for index, photo in enumerate(photos):
            finding = next(
                (
                    item
                    for item in findings
                    if item.get("source") == "image"
                    and (
                        item.get("photo_id") == photo.RPHO_ID
                        or (
                            item.get("photo_id") is None
                            and item.get("photo_index") == index
                        )
                    )
                ),
                None,
            )
            serialized[index]["checked"] = finding is not None
            serialized[index]["flagged_categories"] = (
                flagged_categories(finding) if finding else []
            )
        return serialized

    def get_moderation(self, review):
        """Separate content findings from moderation availability state."""
        data = moderation_data(review)
        text_finding = next(
            (
                item
                for item in moderation_findings(review)
                if item.get("source") == "text"
            ),
            None,
        )
        unavailable = (
            data.get("outcome") == "provider_failure"
            or data.get("incomplete") is True
        )
        retry_state = None
        if unavailable:
            if data.get("retry_exhausted") is True:
                retry_state = "exhausted"
            elif data.get("retryable") is True:
                retry_state = "retrying"
            else:
                retry_state = "awaiting_review"
        local_safety_findings = [
            {
                "category": item.get("category"),
                "matched_rule": item.get("matched_rule"),
            }
            for item in moderation_findings(review)
            if item.get("source") == "local_cebuano_safety"
            and item.get("flagged") is True
        ]
        return {
            "text_checked": text_finding is not None,
            "text_flagged_categories": (
                flagged_categories(text_finding) if text_finding else []
            ),
            "provider_unavailable": unavailable,
            "retry_state": retry_state,
            "checked_at": data.get("checked_at"),
            "local_safety_findings": local_safety_findings,
        }
