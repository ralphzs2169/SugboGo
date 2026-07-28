from rest_framework import serializers

from apps.msme.models import Cluster


class ClusterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CLUS_ID", read_only=True)
    name = serializers.CharField(source="CLUS_NAME", read_only=True)
    description = serializers.CharField(
        source="CLUS_DESCRIPTION",
        read_only=True,
    )

    class Meta:
        model = Cluster
        fields = (
            "id",
            "name",
            "description",
        )


class ClusterCreateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="CLUS_NAME")
    description = serializers.CharField(
        source="CLUS_DESCRIPTION",
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Cluster
        fields = (
            "name",
            "description",
        )

    # Validate that the cluster name is unique (case-insensitive).
    def validate_name(self, value):
        value = value.strip()

        if Cluster.objects.filter(CLUS_NAME__iexact=value).exists():
            raise serializers.ValidationError(
                "A cluster with this name already exists."
            )

        return value


class ClusterUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="CLUS_NAME", required=False)
    description = serializers.CharField(
        source="CLUS_DESCRIPTION",
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Cluster
        fields = (
            "name",
            "description",
        )

   # Validate that the cluster name is unique (case-insensitive).
    def validate_name(self, value):
        value = value.strip()

        queryset = Cluster.objects.filter(CLUS_NAME__iexact=value)

        # Exclude the current cluster during updates so an unchanged
        # name is not treated as a duplicate.
        if self.instance:
            queryset = queryset.exclude(CLUS_ID=self.instance.CLUS_ID)

        if queryset.exists():
            raise serializers.ValidationError(
                "A cluster with this name already exists."
            )

        return value