from rest_framework import serializers

from apps.merchant_application.models import MerchantApplicationFeedback
from apps.merchant_application.services.application_service import ApplicationService


class MerchantApplicationFeedbackSerializer(serializers.ModelSerializer):
    section = serializers.CharField(
        source="MAPF_SECTION",
        read_only=True,
    )
    message = serializers.CharField(
        source="MAPF_MESSAGE",
        read_only=True,
    )
    is_changed = serializers.SerializerMethodField()

    class Meta:
        model = MerchantApplicationFeedback
        fields = (
            "section",
            "message",
            "is_changed",
        )

    def get_is_changed(self, obj):
        return ApplicationService.has_section_changed_after_review(obj)