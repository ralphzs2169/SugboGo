from rest_framework import serializers

from apps.msme.models import Category


class CategorySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="CTGRY_ID", read_only=True)
    name = serializers.CharField(source="CTGRY_NAME", read_only=True)
    description = serializers.CharField(
        source="CTGRY_DESCRIPTION",
        read_only=True,
    )
    cluster_id = serializers.IntegerField(
        source="CLUS_ID.CLUS_ID",
        read_only=True,
    )

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "description",
            "cluster_id",
        )


class CategoryCreateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="CTGRY_NAME")
    description = serializers.CharField(
        source="CTGRY_DESCRIPTION",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="CLUS_ID",
        queryset=Category._meta.get_field("CLUS_ID").remote_field.model.objects.all(),
    )

    class Meta:
        model = Category
        fields = (
            "name",
            "description",
            "cluster_id",
        )

     # Validate that the category name is unique (case-insensitive).
    def validate_name(self, value):
        value = value.strip()

        if Category.objects.filter(CTGRY_NAME__iexact=value).exists():
            raise serializers.ValidationError(
                "A category with this name already exists."
            )

        return value


class CategoryUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="CTGRY_NAME",
        required=False,
    )
    description = serializers.CharField(
        source="CTGRY_DESCRIPTION",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="CLUS_ID",
        queryset=Category._meta.get_field("CLUS_ID").remote_field.model.objects.all(),
        required=False,
    )

    class Meta:
        model = Category
        fields = (
            "name",
            "description",
            "cluster_id",
        )

    # Validate that the category name is unique (case-insensitive).
    def validate_name(self, value):
        value = value.strip()

        queryset = Category.objects.filter(CTGRY_NAME__iexact=value)

        # Exclude the current category during updates so an unchanged
        # name is not treated as a duplicate.
        if self.instance:
            queryset = queryset.exclude(CTGRY_ID=self.instance.CTGRY_ID)

        if queryset.exists():
            raise serializers.ValidationError(
                "A category with this name already exists."
            )

        return value