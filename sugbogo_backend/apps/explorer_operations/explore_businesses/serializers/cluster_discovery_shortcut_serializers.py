from apps.business.models import Cluster, ClusterDiscoveryShortcut
from rest_framework import serializers


class ClusterDiscoveryShortcutClusterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CLUS_ID", read_only=True)
    name = serializers.CharField(source="CLUS_NAME", read_only=True)
    icon = serializers.CharField(source="CLUS_ICON", read_only=True)

    class Meta:
        model = Cluster
        fields = ("id", "name", "icon")


class ClusterDiscoveryShortcutSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CDS_ID", read_only=True)
    title = serializers.CharField(source="CDS_TITLE", read_only=True)
    subtitle = serializers.CharField(source="CDS_SUBTITLE", read_only=True)
    cluster = ClusterDiscoveryShortcutClusterSerializer(source="CLUS_ID", read_only=True)
    business_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ClusterDiscoveryShortcut
        fields = (
            "id",
            "title",
            "subtitle",
            "business_count",
            "cluster",
        )
