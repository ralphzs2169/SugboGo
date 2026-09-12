from rest_framework import serializers

from apps.business.models import Cluster, ClusterDiscoveryShortcut


class ClusterDiscoveryShortcutSerializer(serializers.ModelSerializer):
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
    is_active = serializers.BooleanField(source="CDS_IS_ACTIVE", read_only=True)
    cluster = ClusterDiscoveryShortcutSerializer(source="CLUS_ID", read_only=True)
    business_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(
        source="CDS_CREATED_AT",
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        source="CDS_UPDATED_AT",
        read_only=True,
    )

    class Meta:
        model = ClusterDiscoveryShortcut
        fields = (
            "id",
            "title",
            "subtitle",
            "is_active",
            "business_count",
            "cluster",
            "created_at",
            "updated_at",
        )


class ClusterDiscoveryShortcutWriteSerializer(serializers.ModelSerializer):
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="CLUS_ID",
        queryset=Cluster.objects.all(),
    )
    title = serializers.CharField(source="CDS_TITLE", max_length=100)
    subtitle = serializers.CharField(source="CDS_SUBTITLE", max_length=200)
    is_active = serializers.BooleanField(
        source="CDS_IS_ACTIVE",
        required=False,
        default=True,
    )

    class Meta:
        model = ClusterDiscoveryShortcut
        fields = (
            "cluster_id",
            "title",
            "subtitle",
            "is_active",
        )

    def validate_cluster_id(self, cluster):
        shortcuts = ClusterDiscoveryShortcut.objects.filter(CLUS_ID=cluster)

        if self.instance:
            shortcuts = shortcuts.exclude(CDS_ID=self.instance.CDS_ID)

        if shortcuts.exists():
            raise serializers.ValidationError(
                "This cluster already has a Discovery Shortcut."
            )

        return cluster

    def validate_title(self, value):
        return value.strip()

    def validate_subtitle(self, value):
        return value.strip()
