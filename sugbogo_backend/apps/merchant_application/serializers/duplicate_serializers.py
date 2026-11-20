"""Validate duplicate assessments."""

from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationDuplicateAssessment


class DuplicateReviewCommandSerializer(serializers.Serializer):
    """Require current evidence for assessments and an explanation for substantive decisions."""

    action = serializers.ChoiceField(choices=("assess",))
    submission_id = serializers.IntegerField(required=False)
    candidate_key = serializers.CharField(required=False, max_length=80)
    fingerprint = serializers.CharField(required=False, max_length=64)
    decision = serializers.ChoiceField(
        choices=MerchantApplicationDuplicateAssessment.Decision.choices,
        required=False,
    )
    explanation = serializers.CharField(required=False, allow_blank=True, max_length=4000)

    def validate(
        self,
        attrs,
    ):
        """Validate the supplied submission and matching evidence."""
        required = ("submission_id", "candidate_key", "fingerprint", "decision")
        errors = {}
        for field in required:
            if field not in attrs:
                errors[field] = "This field is required."
        requires_explanation = (
            attrs.get("decision")
            != MerchantApplicationDuplicateAssessment.Decision.UNRESOLVED
        )
        if requires_explanation and not attrs.get("explanation"):
            errors["explanation"] = "Explain this duplicate review decision."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
