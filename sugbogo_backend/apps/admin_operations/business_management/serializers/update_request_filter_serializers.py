from rest_framework import serializers


class BusinessUpdateRequestFilterSerializer(serializers.Serializer):
    """Validate optional business scoping without changing existing queue defaults."""

    business_id = serializers.IntegerField(
        min_value=1,
        required=False,
    )
