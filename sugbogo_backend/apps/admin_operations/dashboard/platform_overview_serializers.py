"""Explicit Dashboard activity-window and account-distribution response fields."""

from rest_framework import serializers


class PlatformActivityWindowSerializer(serializers.Serializer):
    """Expose canonical half-open Manila reporting bounds with current-day incompleteness."""

    start = serializers.DateTimeField(read_only=True)
    end_exclusive = serializers.DateTimeField(read_only=True)
    timezone = serializers.CharField(read_only=True)
    includes_partial_day = serializers.BooleanField(read_only=True)


class PlatformActivityDefinitionsSerializer(serializers.Serializer):
    """State retained-event and publication-coverage limitations without changing count meanings."""

    applications_submitted = serializers.CharField(read_only=True)
    reviews_published = serializers.CharField(read_only=True)
    vouches_created = serializers.CharField(read_only=True)


class PlatformActivityDaySerializer(serializers.Serializer):
    """Expose zero-filled event counts for one Manila calendar date."""

    date = serializers.DateField(read_only=True, format="%Y-%m-%d")
    applications_submitted = serializers.IntegerField(read_only=True)
    reviews_published = serializers.IntegerField(read_only=True)
    vouches_created = serializers.IntegerField(read_only=True)


class PlatformActivitySerializer(serializers.Serializer):
    """Serialize retained submission, first-publication, and vouch-creation events."""

    window = PlatformActivityWindowSerializer(read_only=True)
    applications_submitted = serializers.IntegerField(read_only=True)
    reviews_published = serializers.IntegerField(read_only=True)
    vouches_created = serializers.IntegerField(read_only=True)
    definitions = PlatformActivityDefinitionsSerializer(read_only=True)
    daily = PlatformActivityDaySerializer(many=True, read_only=True)


class UserDistributionSerializer(serializers.Serializer):
    """Count all retained accounts exactly once, disclosing unrecognized assigned roles."""

    total = serializers.IntegerField(read_only=True)
    explorer = serializers.IntegerField(read_only=True)
    merchant = serializers.IntegerField(read_only=True)
    admin = serializers.IntegerField(read_only=True)
    super_admin = serializers.IntegerField(read_only=True)
    unknown_role = serializers.IntegerField(read_only=True)
    scope = serializers.CharField(read_only=True)


class PlatformOverviewSerializer(serializers.Serializer):
    """Serialize independently assembled activity and current account composition."""

    as_of = serializers.DateTimeField(read_only=True)
    active_accounts = serializers.IntegerField(read_only=True)
    activity = PlatformActivitySerializer(read_only=True)
    user_distribution = UserDistributionSerializer(read_only=True)
