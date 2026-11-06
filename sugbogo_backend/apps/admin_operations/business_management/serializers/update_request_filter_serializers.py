from rest_framework import serializers


class BusinessUpdateRequestFilterSerializer(serializers.Serializer):
    """Validate optional business scoping without changing existing queue defaults."""

    business_id = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    queue_view = serializers.ChoiceField(
        choices=("aging", "resolved_today"),
        required=False,
    )


class UpdateRequestSummaryFilterSerializer(serializers.Serializer):
    """Validate the business and request-type scope shared by overview cards."""

    business_id = serializers.IntegerField(
        min_value=1,
        required=False,
    )
    request_type = serializers.ChoiceField(
        choices=("all", "business_name", "classification", "location"),
        default="all",
    )
