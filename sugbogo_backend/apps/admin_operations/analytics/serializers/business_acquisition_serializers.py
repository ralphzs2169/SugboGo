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


class BusinessAcquisitionSerializer(serializers.Serializer):
    """Expose independently reconciled category and cluster counts."""

    categories = AcquisitionGroupSerializer(many=True)
    clusters = AcquisitionGroupSerializer(many=True)
    totals = AcquisitionCountsSerializer()
    definitions = serializers.DictField(child=serializers.CharField())
    meta = AnalyticsMetaSerializer()
