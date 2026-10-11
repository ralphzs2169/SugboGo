from rest_framework import serializers
from apps.shared.serializers.installation_id_serializers import (
    InstallationIdInputSerializer,
)


class BusinessVouchSerializer(InstallationIdInputSerializer):
    """Validates the request data for adding or removing a business vouch."""

    tag_id = serializers.IntegerField(
        min_value=1,
    )
