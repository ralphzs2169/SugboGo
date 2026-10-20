from rest_framework import serializers


class ActivityTimelineQuerySerializer(serializers.Serializer):
    """Validates the selected private activity category."""

    activity_type = serializers.ChoiceField(
        choices=("all", "saves", "vouches", "reviews"),
        default="all",
    )


class ActivityTimelineBusinessSerializer(serializers.Serializer):
    """Exposes business identity and availability without private owner fields."""

    id = serializers.IntegerField(source="business_id")
    business_name = serializers.CharField()
    status = serializers.CharField(source="business_status")
    display_cover_photo_url = serializers.URLField(
        source="business_cover_photo_url",
        allow_null=True,
    )


class ActivityTimelineSerializer(serializers.Serializer):
    """Serializes compact timeline entries with globally distinct activity IDs."""

    id = serializers.SerializerMethodField()
    type = serializers.CharField(source="activity_type")
    source_id = serializers.IntegerField()
    occurred_at = serializers.DateTimeField()
    business = ActivityTimelineBusinessSerializer(source="*")
    specialty = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    def get_id(
        self,
        activity,
    ):
        """Namespaces source IDs so different activity models never collide."""
        return f"{activity['activity_type']}:{activity['source_id']}"

    def get_specialty(
        self,
        activity,
    ):
        """Returns the endorsed specialty only for vouch entries."""
        if activity["activity_type"] != "vouch":
            return None
        return {
            "id": activity["specialty_id"],
            "name": activity["specialty_name"],
            "color": activity["specialty_color"],
            "icon": activity["specialty_icon"],
        }

    def get_review(
        self,
        activity,
    ):
        """Returns author-visible review context without moderation diagnostics."""
        if activity["activity_type"] != "review":
            return None
        return {
            "id": activity["source_id"],
            "excerpt": activity["review_excerpt"],
            "status": activity["review_status"],
            "edited_at": serializers.DateTimeField().to_representation(
                activity["review_edited_at"],
            ),
        }
