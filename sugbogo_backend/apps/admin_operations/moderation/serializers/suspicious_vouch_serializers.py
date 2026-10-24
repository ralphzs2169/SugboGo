"""Admin-only presentation of advisory vouch findings."""

from rest_framework import serializers

from apps.business.models import BusinessVouch
from apps.business.services.vouch_service import VouchService
from apps.reviews.serializers.review_serializers import ReviewAuthorResponseSerializer


class SuspiciousVouchFilterSerializer(serializers.Serializer):
    """Validates search and ordering using existing investigation conventions."""

    search = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    ordering = serializers.ChoiceField(
        choices=("newest", "oldest"),
        required=False,
    )


class VouchContextSerializer(serializers.ModelSerializer):
    """Exposes joined identities and support state without installation identity."""

    id = serializers.IntegerField(source="VOUCH_ID")
    author = ReviewAuthorResponseSerializer(source="USER_ID")
    business = serializers.SerializerMethodField()
    specialty = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(source="VOUCH_CREATED_AT")
    evidence_is_valid = serializers.BooleanField(source="VOUCH_EVIDENCE_IS_VALID")
    withdrawn_at = serializers.DateTimeField(source="VOUCH_WITHDRAWN_AT")

    class Meta:
        model = BusinessVouch
        fields = (
            "id",
            "author",
            "business",
            "specialty",
            "submitted_at",
            "evidence_is_valid",
            "withdrawn_at",
        )

    def get_business(
        self,
        vouch,
    ):
        """Returns the joined business identity."""
        return {
            "id": vouch.BUSN_ID_id,
            "name": vouch.BUSN_ID.BUSN_NAME,
            "cover_photo_url": vouch.BUSN_ID.BUSN_COVER_PHOTO_URL,
        }

    def get_specialty(
        self,
        vouch,
    ):
        """Returns the endorsed specialty identity."""
        return {
            "id": vouch.TAG_ID_id,
            "name": vouch.TAG_ID.TAG_NAME,
        }


class SuspiciousVouchListSerializer(VouchContextSerializer):
    """Includes known reason codes with an explicit historical fallback."""

    reasons = serializers.SerializerMethodField()
    detected_at = serializers.SerializerMethodField()

    class Meta(VouchContextSerializer.Meta):
        fields = (
            *VouchContextSerializer.Meta.fields,
            "reasons",
            "detected_at",
        )

    def get_detected_at(
        self,
        vouch,
    ):
        """Keeps unknown historical detection times distinct from submission time."""
        evidence = vouch.VOUCH_RELIABILITY_EVIDENCE
        if not isinstance(evidence, dict):
            return None
        finding = evidence.get(VouchService.CONCENTRATION_REASON)
        if not isinstance(finding, dict):
            return None
        return finding.get("observed_at")

    def get_reasons(
        self,
        vouch,
    ):
        """Does not invent reasons for historical flags without metadata."""
        evidence = vouch.VOUCH_RELIABILITY_EVIDENCE
        if (
            isinstance(evidence, dict)
            and isinstance(evidence.get(VouchService.CONCENTRATION_REASON), dict)
        ):
            return [VouchService.CONCENTRATION_REASON]
        return ["unknown_reason"]


class SuspiciousVouchDetailSerializer(SuspiciousVouchListSerializer):
    """Separates a small stored snapshot from bounded current records."""

    detection_evidence = serializers.SerializerMethodField()
    current_related_activity = serializers.SerializerMethodField()

    class Meta(SuspiciousVouchListSerializer.Meta):
        fields = (
            *SuspiciousVouchListSerializer.Meta.fields,
            "detection_evidence",
            "current_related_activity",
        )

    def get_detection_evidence(
        self,
        vouch,
    ):
        """Allow-lists snapshot values so raw installation IDs cannot leak."""
        evidence = vouch.VOUCH_RELIABILITY_EVIDENCE
        if not isinstance(evidence, dict):
            return {}
        finding = evidence.get(
            VouchService.CONCENTRATION_REASON,
        )
        if not isinstance(finding, dict):
            return {}
        allowed = (
            "observed_at",
            "window_start",
            "window_hours",
            "distinct_account_count",
            "threshold",
        )
        return {
            VouchService.CONCENTRATION_REASON: {
                key: finding[key]
                for key in allowed
                if key in finding
            },
        }

    def get_current_related_activity(
        self,
        vouch,
    ):
        """Labels unavailable historical context without inventing a window."""
        related = self.context.get("related_vouches")
        if related is None:
            return {
                "items": [],
                "has_more": False,
                "window_unavailable": True,
            }
        return {
            "items": VouchContextSerializer(
                related["items"],
                many=True,
            ).data,
            "has_more": related["has_more"],
            "window_unavailable": False,
        }
