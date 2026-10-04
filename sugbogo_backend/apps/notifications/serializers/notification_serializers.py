from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationQuerySerializer(serializers.Serializer):
    """Validate the optional inbox read-state filter."""

    is_read = serializers.BooleanField(required=False)


class NotificationResponseSerializer(serializers.ModelSerializer):
    """Expose inbox content without recipient identifiers or internal event keys."""

    id = serializers.IntegerField(source="NOTF_ID", read_only=True)
    type = serializers.CharField(source="NOTF_TYPE", read_only=True)
    title = serializers.CharField(source="NOTF_TITLE", read_only=True)
    body = serializers.CharField(source="NOTF_BODY", read_only=True)
    target_type = serializers.CharField(source="NOTF_TARGET_TYPE", read_only=True)
    target_id = serializers.IntegerField(source="NOTF_TARGET_ID", read_only=True)
    read_at = serializers.DateTimeField(source="NOTF_READ_AT", read_only=True)
    created_at = serializers.DateTimeField(source="NOTF_CREATED_AT", read_only=True)
    is_read = serializers.SerializerMethodField()

    def get_is_read(self, obj):
        """Derive read state from the authoritative first-read timestamp."""
        return obj.NOTF_READ_AT is not None

    class Meta:
        model = Notification
        fields = (
            "id", "type", "title", "body", "target_type", "target_id",
            "is_read", "read_at", "created_at",
        )

