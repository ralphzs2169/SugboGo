"""Business acquisition response with exact independent event counts."""

from rest_framework import serializers

from .platform_analytics_serializers import AnalyticsMetaSerializer


class AcquisitionCountsSerializer(serializers.Serializer):
    """Keep creation and approval counts separate."""

    created = serializers.IntegerField()
    approved = serializers.IntegerField()


class AcquisitionGroupSerializer(AcquisitionCountsSerializer):
    """Describe a current classification or the unclassified population."""

    id = serializers.IntegerField(allow_null=True)
    name = serializers.CharField()


class AcquisitionCategorySerializer(serializers.Serializer):
    """Expose a category's creation count within its current parent cluster."""

    id = serializers.IntegerField(allow_null=True)
    name = serializers.CharField()
    created = serializers.IntegerField()


class AcquisitionClusterSerializer(AcquisitionCategorySerializer):
    """Expose the configured cluster icon and reconciled category subtotals."""

    icon = serializers.CharField(
        allow_null=True,
        allow_blank=True,
    )
    categories = AcquisitionCategorySerializer(many=True)


class BusinessAcquisitionSerializer(serializers.Serializer):
    """Expose independent event counts and the current creation-count hierarchy."""

    categories = AcquisitionGroupSerializer(many=True)
    clusters = AcquisitionGroupSerializer(many=True)
    hierarchy = AcquisitionClusterSerializer(many=True)
    totals = AcquisitionCountsSerializer()
    definitions = serializers.DictField(child=serializers.CharField())
    meta = AnalyticsMetaSerializer()
