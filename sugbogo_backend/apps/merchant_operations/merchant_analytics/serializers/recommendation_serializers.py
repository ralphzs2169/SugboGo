"""Strict owner-free requests and explicit stored-recommendation response allowlists."""

from rest_framework import serializers

from .peer_report_serializers import ReportFindingSerializer
from .standard_analytics_serializers import OwnedBusinessSerializer, StandardAnalyticsQuerySerializer


class RecommendationQuerySerializer(StandardAnalyticsQuerySerializer):
    """Reuse existing date selection without accepting prompts, ownership, or policy overrides."""


class RecommendationItemSerializer(serializers.Serializer):
    """Expose vetted wording with its supporting deterministic finding codes."""

    action_code = serializers.CharField()
    evidence_codes = serializers.ListField(child=serializers.CharField())
    explanation_code = serializers.CharField()
    message = serializers.CharField()


class RecommendationResponseSerializer(serializers.Serializer):
    """Expose source coverage and provenance separately from current fallback evidence."""

    business = OwnedBusinessSerializer()
    state = serializers.CharField()
    stored_state = serializers.CharField(allow_null=True)
    request_id = serializers.UUIDField(allow_null=True)
    source_period = serializers.JSONField(allow_null=True)
    requested_selection = serializers.JSONField()
    requested_at = serializers.DateTimeField(allow_null=True)
    generated_at = serializers.DateTimeField(allow_null=True)
    checked_at = serializers.DateTimeField()
    evidence_matches = serializers.BooleanField()
    snapshot_only = serializers.BooleanField()
    content_available = serializers.BooleanField()
    ai_recommendations = RecommendationItemSerializer(many=True)
    generation_policy = serializers.JSONField(allow_null=True)
    provenance = serializers.JSONField(allow_null=True)
    error_code = serializers.CharField(allow_null=True)
    key_findings = ReportFindingSerializer(many=True)
    recommended_actions = ReportFindingSerializer(many=True)
    meta = serializers.JSONField()
    measurement_note = serializers.CharField()


class RecommendationRefreshSerializer(serializers.Serializer):
    """Return persisted queue acknowledgement without pretending generation already completed."""

    request_id = serializers.UUIDField()
    state = serializers.CharField()
    created = serializers.BooleanField()
    source_period = serializers.JSONField()
