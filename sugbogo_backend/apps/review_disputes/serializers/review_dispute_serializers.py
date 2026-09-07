from pathlib import Path

from rest_framework import serializers

from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
)
from apps.reviews.models import Review
from apps.reviews.serializers.review_serializers import (
    ReviewAuthorResponseSerializer,
    ReviewPhotoResponseSerializer,
)


MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024
DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
}


class DisputeEvidenceResponseSerializer(serializers.ModelSerializer):
    """Serializer for review dispute evidence responses."""

    id = serializers.IntegerField(
        source="MRDSE_ID",
        read_only=True,
    )

    type = serializers.CharField(
        source="MRDSE_TYPE",
        read_only=True,
    )

    file_name = serializers.CharField(
        source="MRDSE_FILE_NAME",
        read_only=True,
        allow_null=True,
    )

    url = serializers.URLField(
        source="MRDSE_URL",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="MRDSE_CREATED_AT",
        read_only=True,
    )

    class Meta:
        model = MerchantReviewDisputeEvidence
        fields = (
            "id",
            "type",
            "file_name",
            "url",
            "created_at",
        )


class MerchantReviewDisputeCreateSerializer(serializers.Serializer):
    """Serializer for submitting a merchant review dispute."""

    reason = serializers.ChoiceField(
        choices=MerchantReviewDispute.DisputeReason.choices,
    )

    description = serializers.CharField(
        max_length=2000,
        min_length=1,
    )


class MerchantReviewDisputeEvidenceCreateSerializer(serializers.Serializer):
    """Serializer for validating merchant dispute evidence uploads."""

    type = serializers.ChoiceField(
        choices=MerchantReviewDisputeEvidence.EvidenceType.choices,
    )

    file = serializers.FileField()

    def validate(self, attrs):
        file = attrs["file"]
        evidence_type = attrs["type"]

        if file.size > MAX_EVIDENCE_FILE_SIZE:
            raise serializers.ValidationError(
                "Evidence files must be 10 MB or smaller.",
            )

        if evidence_type == MerchantReviewDisputeEvidence.EvidenceType.IMAGE:
            image_field = serializers.ImageField()
            image_field.run_validation(file)

        if evidence_type == MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT:
            extension = Path(file.name).suffix.lower()

            if extension not in DOCUMENT_EXTENSIONS:
                raise serializers.ValidationError(
                    "Evidence documents must be a PDF, DOC, or DOCX file.",
                )

        return attrs


class DisputedReviewResponseSerializer(serializers.ModelSerializer):
    """Serializer for the review context shown with a merchant dispute."""

    id = serializers.IntegerField(
        source="REVW_ID",
        read_only=True,
    )

    text = serializers.CharField(
        source="REVW_TEXT",
        read_only=True,
    )

    status = serializers.CharField(
        source="REVW_STATUS",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="REVW_CREATED_AT",
        read_only=True,
    )

    author = ReviewAuthorResponseSerializer(
        source="USER_ID",
        read_only=True,
    )

    photos = ReviewPhotoResponseSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Review
        fields = (
            "id",
            "text",
            "status",
            "created_at",
            "author",
            "photos",
        )


class MerchantReviewDisputeResponseSerializer(serializers.ModelSerializer):
    """Serializer for merchant review dispute responses."""

    id = serializers.IntegerField(
        source="MRDSP_ID",
        read_only=True,
    )

    review_id = serializers.IntegerField(
        source="REVW_ID_id",
        read_only=True,
    )

    business_id = serializers.IntegerField(
        source="BUSN_ID_id",
        read_only=True,
    )

    reason = serializers.CharField(
        source="MRDSP_REASON",
        read_only=True,
    )

    description = serializers.CharField(
        source="MRDSP_DESCRIPTION",
        read_only=True,
    )

    status = serializers.CharField(
        source="MRDSP_STATUS",
        read_only=True,
    )

    admin_notes = serializers.CharField(
        source="MRDSP_ADMIN_NOTES",
        read_only=True,
    )

    resolved_at = serializers.DateTimeField(
        source="MRDSP_RESOLVED_AT",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="MRDSP_CREATED_AT",
        read_only=True,
    )

    updated_at = serializers.DateTimeField(
        source="MRDSP_UPDATED_AT",
        read_only=True,
    )

    evidence = DisputeEvidenceResponseSerializer(
        many=True,
        read_only=True,
    )

    review = DisputedReviewResponseSerializer(
        source="REVW_ID",
        read_only=True,
    )

    class Meta:
        model = MerchantReviewDispute
        fields = (
            "id",
            "review_id",
            "business_id",
            "reason",
            "description",
            "status",
            "admin_notes",
            "resolved_at",
            "created_at",
            "updated_at",
            "evidence",
            "review",
        )


class MerchantReviewDisputeHistorySerializer(serializers.ModelSerializer):
    """Serializer for a previous dispute attempt on the same review."""

    id = serializers.IntegerField(
        source="MRDSP_ID",
        read_only=True,
    )

    reason = serializers.CharField(
        source="MRDSP_REASON",
        read_only=True,
    )

    description = serializers.CharField(
        source="MRDSP_DESCRIPTION",
        read_only=True,
    )

    status = serializers.CharField(
        source="MRDSP_STATUS",
        read_only=True,
    )

    admin_notes = serializers.CharField(
        source="MRDSP_ADMIN_NOTES",
        read_only=True,
    )

    resolved_at = serializers.DateTimeField(
        source="MRDSP_RESOLVED_AT",
        read_only=True,
    )

    created_at = serializers.DateTimeField(
        source="MRDSP_CREATED_AT",
        read_only=True,
    )

    evidence = DisputeEvidenceResponseSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = MerchantReviewDispute
        fields = (
            "id",
            "reason",
            "description",
            "status",
            "admin_notes",
            "resolved_at",
            "created_at",
            "evidence",
        )


class MerchantReviewDisputeDetailSerializer(
    MerchantReviewDisputeResponseSerializer,
):
    """Serializer for a dispute with its previous attempt history."""

    attempt_number = serializers.IntegerField(
        read_only=True,
    )

    previous_dispute_count = serializers.IntegerField(
        read_only=True,
    )

    previous_disputes = MerchantReviewDisputeHistorySerializer(
        many=True,
        read_only=True,
    )

    class Meta(MerchantReviewDisputeResponseSerializer.Meta):
        fields = (
            *MerchantReviewDisputeResponseSerializer.Meta.fields,
            "attempt_number",
            "previous_dispute_count",
            "previous_disputes",
        )
