from rest_framework import serializers

from apps.business.models import Business


class BusinessListSerializer(serializers.ModelSerializer):
    """UC-02 Browse Businesses (stub) — lightweight, for list view."""
    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    name = serializers.CharField(source="BUSN_NAME", read_only=True)
    status = serializers.CharField(source="BUSN_STATUS", read_only=True)
    is_verified = serializers.BooleanField(source="BUSN_IS_VERIFIED", read_only=True)
    vouch_count = serializers.IntegerField(source="BUSN_VOUCH_COUNT", read_only=True)
    review_count = serializers.IntegerField(source="BUSN_REVIEW_COUNT", read_only=True)
    category_name = serializers.CharField(source="CTGRY_ID.CTGRY_NAME", read_only=True)
    cluster_name = serializers.CharField(source="CTGRY_ID.CLUS_ID.CLUS_NAME", read_only=True)

    class Meta:
        model = Business
        fields = (
            "id", "name", "status", "is_verified",
            "vouch_count", "review_count",
            "category_name", "cluster_name",
        )


class BusinessDetailSerializer(serializers.ModelSerializer):
    """UC-02 View Business Profile (stub) — full detail view."""
    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    name = serializers.CharField(source="BUSN_NAME", read_only=True)
    description = serializers.CharField(source="BUSN_DESCRIPTION", read_only=True)
    status = serializers.CharField(source="BUSN_STATUS", read_only=True)
    is_verified = serializers.BooleanField(source="BUSN_IS_VERIFIED", read_only=True)
    vouch_count = serializers.IntegerField(source="BUSN_VOUCH_COUNT", read_only=True)
    review_count = serializers.IntegerField(source="BUSN_REVIEW_COUNT", read_only=True)
    pocket_count = serializers.IntegerField(source="BUSN_POCKET_COUNT", read_only=True)
    created_at = serializers.DateTimeField(source="BUSN_CREATED_AT", read_only=True)
    category_name = serializers.CharField(source="CTGRY_ID.CTGRY_NAME", read_only=True)
    cluster_name = serializers.CharField(source="CTGRY_ID.CLUS_ID.CLUS_NAME", read_only=True)
    address = serializers.CharField(source="LOC_ID.LOCT_ADDRESS", read_only=True)

    class Meta:
        model = Business
        fields = (
            "id", "name", "description", "status", "is_verified",
            "vouch_count", "review_count", "pocket_count", "created_at",
            "category_name", "cluster_name", "address",
        )


class BusinessVerifyActionSerializer(serializers.Serializer):
    """
    Input serializer for the Admin verify/reject action (UC-12 stub).
    Deliberately NOT a ModelSerializer — this is a binary action,
    not a field edit, per UC-12's Non-Functional requirement:
    "Admin role is limited to binary Yes/No verification."
    """
    action = serializers.ChoiceField(choices=["approve", "reject"])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)