from rest_framework import serializers

from apps.msme.models import Msme


class MsmeListSerializer(serializers.ModelSerializer):
    """UC-02 Browse MSMEs (stub) — lightweight, for list view."""
    id = serializers.IntegerField(source="MSME_ID", read_only=True)
    name = serializers.CharField(source="MSME_NAME", read_only=True)
    status = serializers.CharField(source="MSME_STATUS", read_only=True)
    is_verified = serializers.BooleanField(source="MSME_IS_VERIFIED", read_only=True)
    vouch_count = serializers.IntegerField(source="MSME_VOUCH_COUNT", read_only=True)
    review_count = serializers.IntegerField(source="MSME_REVIEW_COUNT", read_only=True)
    category_name = serializers.CharField(source="CTGRY_ID.CTGRY_NAME", read_only=True)
    cluster_name = serializers.CharField(source="CTGRY_ID.CLUS_ID.CLUS_NAME", read_only=True)

    class Meta:
        model = Msme
        fields = (
            "id", "name", "status", "is_verified",
            "vouch_count", "review_count",
            "category_name", "cluster_name",
        )


class MsmeDetailSerializer(serializers.ModelSerializer):
    """UC-02 View MSME Profile (stub) — full detail view."""
    id = serializers.IntegerField(source="MSME_ID", read_only=True)
    name = serializers.CharField(source="MSME_NAME", read_only=True)
    description = serializers.CharField(source="MSME_DESCRIPTION", read_only=True)
    status = serializers.CharField(source="MSME_STATUS", read_only=True)
    is_verified = serializers.BooleanField(source="MSME_IS_VERIFIED", read_only=True)
    vouch_count = serializers.IntegerField(source="MSME_VOUCH_COUNT", read_only=True)
    review_count = serializers.IntegerField(source="MSME_REVIEW_COUNT", read_only=True)
    pocket_count = serializers.IntegerField(source="MSME_POCKET_COUNT", read_only=True)
    created_at = serializers.DateTimeField(source="MSME_CREATED_AT", read_only=True)
    category_name = serializers.CharField(source="CTGRY_ID.CTGRY_NAME", read_only=True)
    cluster_name = serializers.CharField(source="CTGRY_ID.CLUS_ID.CLUS_NAME", read_only=True)
    address = serializers.CharField(source="LOC_ID.LOCT_ADDRESS", read_only=True)

    class Meta:
        model = Msme
        fields = (
            "id", "name", "description", "status", "is_verified",
            "vouch_count", "review_count", "pocket_count", "created_at",
            "category_name", "cluster_name", "address",
        )


class MsmeVerifyActionSerializer(serializers.Serializer):
    """
    Input serializer for the Admin verify/reject action (UC-12 stub).
    Deliberately NOT a ModelSerializer — this is a binary action,
    not a field edit, per UC-12's Non-Functional requirement:
    "Admin role is limited to binary Yes/No verification."
    """
    action = serializers.ChoiceField(choices=["approve", "reject"])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)