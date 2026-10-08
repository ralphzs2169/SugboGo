from rest_framework import serializers

from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessClassificationSpecialtySnapshot,
)
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    BusinessNameChangeUserSerializer,
)


class BusinessClassificationChangeCreateSerializer(serializers.Serializer):
    """Validate the submitted category and complete three-tag proposal."""

    proposed_category_id = serializers.IntegerField(min_value=1)
    proposed_specialty_tag_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=3,
        max_length=3,
        allow_empty=False,
    )

    def validate_proposed_specialty_tag_ids(self, value):
        """Reject duplicate IDs even when the submitted list has length three."""
        if len(set(value)) != 3:
            raise serializers.ValidationError(
                "Please select exactly 3 distinct specialty tags."
            )
        return value

    def validate(self, attrs):
        """Require the cluster to come from the selected category."""
        if "proposed_cluster_id" in self.initial_data:
            raise serializers.ValidationError({
                "proposed_cluster_id": ["Cluster is derived from the category."],
            })
        return attrs


class BusinessClassificationChangeRejectSerializer(serializers.Serializer):
    """Require a concise rejection reason visible to the merchant."""

    rejection_reason = serializers.CharField(
        min_length=1,
        max_length=1000,
        trim_whitespace=True,
    )


class MerchantBusinessClassificationChangeSerializer(serializers.ModelSerializer):
    """Present retained request snapshots without internal review metadata."""

    id = serializers.IntegerField(source="BCCR_ID", read_only=True)
    request_type = serializers.SerializerMethodField()
    status = serializers.CharField(source="BCCR_STATUS", read_only=True)
    previous = serializers.SerializerMethodField()
    proposed = serializers.SerializerMethodField()
    submitted_at = serializers.DateTimeField(
        source="BCCR_SUBMITTED_AT",
        read_only=True,
    )
    resolved_at = serializers.DateTimeField(
        source="BCCR_RESOLVED_AT",
        read_only=True,
    )
    rejection_reason = serializers.CharField(
        source="BCCR_REJECTION_REASON",
        read_only=True,
    )

    class Meta:
        model = BusinessClassificationChangeRequest
        fields = (
            "id",
            "request_type",
            "status",
            "previous",
            "proposed",
            "submitted_at",
            "resolved_at",
            "rejection_reason",
        )

    def get_request_type(self, obj):
        """Identify classification requests in future combined history views."""
        return "classification"

    def _snapshot(self, obj, side):
        """Build a stable submitted category, cluster, and specialty snapshot."""
        if side == BusinessClassificationSpecialtySnapshot.Side.PREVIOUS:
            category_id = obj.PREVIOUS_CTGRY_ID_id
            category_name = obj.BCCR_PREVIOUS_CATEGORY_NAME
            cluster_id = obj.BCCR_PREVIOUS_CLUSTER_ID
            cluster_name = obj.BCCR_PREVIOUS_CLUSTER_NAME
        else:
            category_id = obj.PROPOSED_CTGRY_ID_id
            category_name = obj.BCCR_PROPOSED_CATEGORY_NAME
            cluster_id = obj.BCCR_PROPOSED_CLUSTER_ID
            cluster_name = obj.BCCR_PROPOSED_CLUSTER_NAME

        return {
            "category": {"id": category_id, "name": category_name},
            "cluster": {"id": cluster_id, "name": cluster_name},
            "specialty_tags": [
                {
                    "id": snapshot.TAG_ID_id,
                    "name": snapshot.BCSS_TAG_NAME,
                }
                for snapshot in obj.specialty_snapshots.all()
                if snapshot.BCSS_SIDE == side
            ],
        }

    def get_previous(self, obj):
        """Return the classification captured before submission."""
        return self._snapshot(
            obj,
            BusinessClassificationSpecialtySnapshot.Side.PREVIOUS,
        )

    def get_proposed(self, obj):
        """Return the submitted classification proposal."""
        return self._snapshot(
            obj,
            BusinessClassificationSpecialtySnapshot.Side.PROPOSED,
        )


class AdminBusinessClassificationChangeSerializer(
    MerchantBusinessClassificationChangeSerializer
):
    """Add live classification and reviewer context for Admin decisions."""

    business_id = serializers.IntegerField(source="BUSN_ID_id", read_only=True)
    current_business_name = serializers.CharField(
        source="BUSN_ID.BUSN_NAME",
        read_only=True,
    )
    cover_photo_url = serializers.URLField(
        source="BUSN_ID.BUSN_COVER_PHOTO_URL",
        read_only=True,
    )
    current = serializers.SerializerMethodField()
    merchant = BusinessNameChangeUserSerializer(source="USER_ID", read_only=True)
    reviewer = BusinessNameChangeUserSerializer(source="REVIEWER_ID", read_only=True)

    class Meta(MerchantBusinessClassificationChangeSerializer.Meta):
        fields = MerchantBusinessClassificationChangeSerializer.Meta.fields + (
            "business_id",
            "current_business_name",
            "cover_photo_url",
            "current",
            "merchant",
            "reviewer",
        )

    def get_current(self, obj):
        """Show live values separately from the captured previous snapshot."""
        category = obj.BUSN_ID.CTGRY_ID
        links = getattr(obj.BUSN_ID, "active_classification_links", None)
        if links is None:
            links = (
                obj.BUSN_ID.specialty_tag_links
                .filter(BST_IS_ACTIVE=True)
                .select_related("TAG_ID")
                .order_by("TAG_ID_id")
            )
        return {
            "category": {"id": category.CTGRY_ID, "name": category.CTGRY_NAME},
            "cluster": {
                "id": category.CLUS_ID_id,
                "name": category.CLUS_ID.CLUS_NAME,
            },
            "specialty_tags": [
                {"id": link.TAG_ID_id, "name": link.TAG_ID.TAG_NAME}
                for link in links
            ],
        }
