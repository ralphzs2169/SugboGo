"""Input validation for queue-wide moderation summaries."""

from rest_framework import serializers


class ModerationMetricsFilterSerializer(serializers.Serializer):
    """Restrict summaries to the established moderation tabs."""

    tab = serializers.ChoiceField(
        choices=("under-review", "suspicious", "reported", "disputes"),
        default="under-review",
    )


class ModerationAgingFilterSerializer(serializers.Serializer):
    """Validate the optional shared aging filter."""

    aging = serializers.BooleanField(
        required=False,
        default=False,
    )
