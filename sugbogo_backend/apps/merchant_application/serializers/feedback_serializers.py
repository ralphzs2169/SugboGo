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
        """Share content reads with other feedback in this response."""
        changed = ApplicationService.get_changed_sections(
            obj.MAREV_ID,
            fingerprint_cache=self.context.setdefault("_merchant_section_fingerprints", {}),
        )
        return obj.MAPF_SECTION in changed
