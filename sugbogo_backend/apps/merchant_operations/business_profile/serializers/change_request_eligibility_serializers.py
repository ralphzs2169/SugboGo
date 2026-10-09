from rest_framework import serializers


class BusinessChangeRequestEligibilitySerializer(serializers.Serializer):
    """Serializes one request type's current submission eligibility."""

    can_submit = serializers.BooleanField()
    reason = serializers.ChoiceField(
        choices=("pending", "cooldown"),
        allow_null=True,
    )
    cooldown_duration_hours = serializers.IntegerField()
    cooldown_until = serializers.DateTimeField(allow_null=True)
    last_approved_request_id = serializers.IntegerField(allow_null=True)
    pending_request_id = serializers.IntegerField(allow_null=True)


class BusinessChangePendingStatusSerializer(serializers.Serializer):
    """Serializes the three merchant business change pending flags."""

    business_name = serializers.BooleanField()
    classification = serializers.BooleanField()
    location = serializers.BooleanField()
