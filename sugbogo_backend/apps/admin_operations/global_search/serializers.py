from rest_framework import serializers


SEARCH_TYPES = (
    "business",
    "user",
    "application",
    "business_name_request",
    "classification_request",
    "location_request",
    "review",
    "review_dispute",
)


class GlobalSearchQuerySerializer(serializers.Serializer):
    """Validate trimmed search text and a small per-category result limit."""

    search = serializers.CharField(
        min_length=2,
        max_length=200,
        trim_whitespace=True,
    )
    limit_per_type = serializers.IntegerField(
        min_value=1,
        max_value=5,
        default=3,
    )


class GlobalSearchItemSerializer(serializers.Serializer):
    """Expose only compact identity and original lifecycle status fields."""

    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    subtitle = serializers.CharField(
        read_only=True,
        allow_null=True,
        allow_blank=True,
    )
    status = serializers.CharField(read_only=True)


class GlobalSearchGroupSerializer(serializers.Serializer):
    """Describe one authorized category without inventory count queries."""

    type = serializers.ChoiceField(
        choices=SEARCH_TYPES,
        read_only=True,
    )
    items = GlobalSearchItemSerializer(
        many=True,
        read_only=True,
    )
    has_more = serializers.BooleanField(read_only=True)


class GlobalSearchResponseSerializer(serializers.Serializer):
    """Serialize the normalized query and consistently ordered result groups."""

    search = serializers.CharField(read_only=True)
    groups = GlobalSearchGroupSerializer(
        many=True,
        read_only=True,
    )
