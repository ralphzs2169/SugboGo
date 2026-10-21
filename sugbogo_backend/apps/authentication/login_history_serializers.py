from rest_framework import serializers

from apps.authentication.models import LoginEvent


class LoginEventSerializer(serializers.ModelSerializer):
    """Exposes minimal activity metadata without account identifiers or secrets."""

    id = serializers.IntegerField(source="LEVT_ID", read_only=True)
    method = serializers.CharField(source="LEVT_METHOD", read_only=True)
    outcome = serializers.CharField(source="LEVT_OUTCOME", read_only=True)
    ip_address = serializers.IPAddressField(source="LEVT_IP_ADDRESS", read_only=True)
    platform = serializers.CharField(source="LEVT_PLATFORM", read_only=True)
    client = serializers.CharField(source="LEVT_CLIENT", read_only=True)
    created_at = serializers.DateTimeField(source="LEVT_CREATED_AT", read_only=True)

    class Meta:
        model = LoginEvent
        fields = ["id", "method", "outcome", "ip_address", "platform", "client", "created_at"]
