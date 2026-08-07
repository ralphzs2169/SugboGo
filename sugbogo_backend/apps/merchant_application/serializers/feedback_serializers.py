from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationFeedback


class MerchantApplicationFeedbackSerializer(serializers.ModelSerializer):
    section = serializers.CharField(source="MAPF_SECTION", read_only=True)
    message = serializers.CharField(source="MAPF_MESSAGE", read_only=True)

    class Meta:
        model = MerchantApplicationFeedback
        fields = (
            "section",
            "message",
        )