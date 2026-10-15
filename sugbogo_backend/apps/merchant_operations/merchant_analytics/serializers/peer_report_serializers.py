"""Explicit anonymous peer and composed Premium report response contracts."""

from rest_framework import serializers

from .premium_analytics_serializers import (
    ChangeSerializer, PremiumReportSerializer, PremiumReviewInsightsSerializer,
    PremiumReviewPerformanceSerializer, PremiumSpecialtySerializer, PremiumVisibilitySerializer,
)
from .standard_analytics_serializers import StandardAnalyticsSerializer


class PeerGroupSerializer(serializers.Serializer):
    """Expose selection scope and population counts without peer identities."""

    scope = serializers.ChoiceField(choices=("category", "cluster"))
    size = serializers.IntegerField()
    minimum_size = serializers.IntegerField()
    policy_version = serializers.IntegerField()
    positive_share_min_classified_reviews = serializers.IntegerField()
    fallback_reason = serializers.CharField(allow_null=True)
    eligibility = serializers.CharField()


class PeerMetricSerializer(serializers.Serializer):
    """Suppress numerical comparisons when sample or source evidence is insufficient."""

    label = serializers.CharField()
    unit = serializers.CharField()
    status = serializers.ChoiceField(choices=("available", "partial", "insufficient_data", "unavailable"))
    reason = serializers.CharField(allow_null=True)
    merchant_value = serializers.FloatField(allow_null=True)
    peer_median = serializers.FloatField(allow_null=True)
    position = serializers.ChoiceField(choices=("above_median", "at_median", "below_median"), allow_null=True)
    eligible_peer_sample_size = serializers.IntegerField(allow_null=True)
    merchant_classified_review_count = serializers.IntegerField(allow_null=True)


class PeerAnalyticsSerializer(PremiumReportSerializer):
    """Allow aggregate group metadata and only the four approved comparisons."""

    status = serializers.CharField()
    reason = serializers.CharField(allow_null=True)
    group = PeerGroupSerializer()
    metrics = serializers.DictField(child=PeerMetricSerializer())
    sources = serializers.DictField(child=serializers.JSONField())


class PremiumSectionsSerializer(serializers.Serializer):
    """Reuse each existing Premium response allowlist in the report."""

    visibility = PremiumVisibilitySerializer()
    pocket = PremiumVisibilitySerializer()
    specialties = PremiumSpecialtySerializer()
    review_insights = PremiumReviewInsightsSerializer()
    review_performance = PremiumReviewPerformanceSerializer()


class ReportResultsSerializer(serializers.Serializer):
    """Preserve Standard and Premium boundaries inside the explicitly Premium report."""

    standard = StandardAnalyticsSerializer()
    premium = PremiumSectionsSerializer()


class ReportChangesSerializer(serializers.Serializer):
    """Reuse existing comparisons without inferring growth from unavailable tracking."""

    visibility = serializers.DictField(child=ChangeSerializer())
    pocket = serializers.DictField(child=ChangeSerializer())
    reply_rate = ChangeSerializer()


class ReportFindingSerializer(serializers.Serializer):
    """Expose stable rule codes and plain-language evidence or recommendations."""

    code = serializers.CharField()
    message = serializers.CharField()


class MerchantReportSerializer(PremiumReportSerializer):
    """Expose sanitized section results, peer medians, and deterministic findings only."""

    report_version = serializers.CharField()
    policy_version = serializers.IntegerField()
    snapshot_as_of = serializers.CharField()
    results = ReportResultsSerializer()
    changes = ReportChangesSerializer()
    peers = PeerAnalyticsSerializer()
    key_findings = ReportFindingSerializer(many=True)
    recommended_actions = ReportFindingSerializer(many=True)
    measurement_note = serializers.CharField()
