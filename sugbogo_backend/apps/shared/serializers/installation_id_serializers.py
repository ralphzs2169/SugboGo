from rest_framework import serializers


class InstallationIdInputSerializer(serializers.Serializer):
    """Accept the canonical installation ID and a temporary legacy input alias."""

    installation_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    # Remove this alias after deployed clients using device_id have aged out.
    device_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        allow_null=True,
        write_only=True,
    )

    def validate(self, attrs):
        """Normalize a legacy identifier without silently choosing conflicting data."""
        if "device_id" not in attrs:
            return attrs

        legacy_id = attrs.pop("device_id")
        if (
            "installation_id" in attrs
            and attrs["installation_id"] != legacy_id
        ):
            raise serializers.ValidationError({
                "installation_id": (
                    "installation_id and device_id must match when both are provided."
                ),
            })

        attrs["installation_id"] = legacy_id
        return attrs
