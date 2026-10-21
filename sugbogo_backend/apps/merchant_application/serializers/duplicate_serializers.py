"""Validate duplicate assessments and explicit reconsideration commands."""

from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationDuplicateAssessment


class DuplicateReviewCommandSerializer(serializers.Serializer):
    """Require current evidence for assessments and an explanation for substantive decisions."""

    action = serializers.ChoiceField(choices=("assess", "reconsider"))
    submission_id = serializers.IntegerField(required=False)
    candidate_key = serializers.CharField(required=False, max_length=80)
    fingerprint = serializers.CharField(required=False, max_length=64)
    decision = serializers.ChoiceField(
        choices=MerchantApplicationDuplicateAssessment.Decision.choices,
        required=False,
    )
    explanation = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    review_id = serializers.IntegerField(required=False)

    def validate(
        self,
        attrs,
    ):
        """Validate only the fields meaningful for the requested operation."""
        if attrs["action"] == "assess":
            required = ("submission_id", "candidate_key", "fingerprint", "decision")
        else:
            required = ("review_id",)
        errors = {}
        for field in required:
            if field not in attrs:
                errors[field] = "This field is required."
        requires_explanation = (
            attrs["action"] == "reconsider"
            or attrs.get("decision")
            != MerchantApplicationDuplicateAssessment.Decision.UNRESOLVED
        )
        if requires_explanation and not attrs.get("explanation"):
            errors["explanation"] = "Explain this duplicate review decision."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
