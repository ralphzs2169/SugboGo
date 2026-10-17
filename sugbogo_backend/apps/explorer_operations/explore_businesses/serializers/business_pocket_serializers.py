from rest_framework import serializers


class BusinessPocketSerializer(serializers.Serializer):
    """Only the saved business information needed by My Pockets."""

    id = serializers.IntegerField(source="PCKT_ID", read_only=True)
    business_id = serializers.IntegerField(source="BUSN_ID_id", read_only=True)
    name = serializers.CharField(source="BUSN_ID.BUSN_NAME", read_only=True)
    photo_url = serializers.URLField(
        source="BUSN_ID.BUSN_COVER_PHOTO_URL", read_only=True, allow_null=True,
    )
    category = serializers.CharField(
        source="BUSN_ID.CTGRY_ID.CTGRY_NAME", read_only=True,
    )
    location = serializers.CharField(
        source="BUSN_ID.LOCT_ID.LOCT_ADDRESS", read_only=True,
    )
    saved_at = serializers.DateTimeField(source="PCKT_CREATED_AT", read_only=True)
