from rest_framework import serializers

from apps.business.services.route_planning_event_service import NavigationMethod


class RouteIntentSerializer(serializers.Serializer):
    """Accept only a navigation method; identity and time always come from the server."""

    navigation_method = serializers.ChoiceField(
        choices=tuple(NavigationMethod),
    )

    def validate(
        self,
        attrs,
    ):
        """Reject extra identity, location and timestamp payloads instead of storing them."""
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({
                key: "Unsupported route-intent parameter."
                for key in sorted(unknown)
            })
        return attrs
