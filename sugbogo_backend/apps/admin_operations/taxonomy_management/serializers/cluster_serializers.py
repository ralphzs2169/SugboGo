from rest_framework import serializers

from apps.business.models import Cluster


class ClusterSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CLUS_ID", read_only=True)
    name = serializers.CharField(source="CLUS_NAME", read_only=True)
    icon = serializers.CharField(source="CLUS_ICON", read_only=True)
    description = serializers.CharField(
        source="CLUS_DESCRIPTION",
        read_only=True,
    )
    created_at = serializers.DateTimeField(source="CLUS_CREATED_AT", read_only=True)
    updated_at = serializers.DateTimeField(source="CLUS_UPDATED_AT", read_only=True)
    category_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Cluster
        fields = (
            "id",
            "name",
            "icon",
            "description",
            "category_count",
            "updated_at",
            "created_at",
        )
        
class ClusterCreateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="CLUS_NAME",
        error_messages={
            "blank": "Cluster name is required.",
            "null": "Cluster name is required.",
            "required": "Cluster name is required.",
        },
    )
    icon = serializers.ChoiceField(
        source="CLUS_ICON",
        choices=Cluster.ClusterIcon.choices,
    )
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
            "icon",
            "description",
        )

    def validate_name(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Cluster name must be at least 3 characters."
            )

        if Cluster.objects.filter(CLUS_NAME__iexact=value).exists():
            raise serializers.ValidationError(
                "A cluster with this name already exists."
            )

        return value


class ClusterUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="CLUS_NAME",
        required=False,
        error_messages={
            "blank": "Cluster name is required.",
            "null": "Cluster name is required.",
        },
    )
    icon = serializers.ChoiceField(
        source="CLUS_ICON",
        choices=Cluster.ClusterIcon.choices,
        required=False,
    )
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
            "icon",
            "description",
        )

    def validate_name(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Cluster name must be at least 3 characters."
            )

        queryset = Cluster.objects.filter(CLUS_NAME__iexact=value)

        if self.instance:
            queryset = queryset.exclude(CLUS_ID=self.instance.CLUS_ID)

        if queryset.exists():
            raise serializers.ValidationError(
                "A cluster with this name already exists."
            )

        return value