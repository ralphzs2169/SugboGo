from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationFeedback


class MerchantApplicationFeedbackInputSerializer(serializers.Serializer):
    section = serializers.ChoiceField(choices=MerchantApplicationFeedback.Section.choices)
    message = serializers.CharField(trim_whitespace=True, max_length=2000)


class MerchantApplicationReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject"))
    rejection_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        max_length=5000,
    )
    feedback = MerchantApplicationFeedbackInputSerializer(
        many=True,
        required=False,
        allow_empty=False,
    )

    def validate(self, attrs):
        if attrs["action"] == "reject":
            if not attrs.get("rejection_reason"):
                raise serializers.ValidationError({
                    "rejection_reason": "A rejection reason is required."
                })
            if not attrs.get("feedback"):
                raise serializers.ValidationError({
                    "feedback": "At least one feedback item is required."
                })
        return attrs
