from rest_framework import serializers


class RequestEmailChangeSerializer(serializers.Serializer):
    """Validates the destination and exact current-password proof."""

    new_email = serializers.EmailField(max_length=100)
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)


class ConfirmEmailChangeSerializer(serializers.Serializer):
    """Requires both the emailed secret and current-password proof."""

    request_id = serializers.UUIDField()
    token = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
