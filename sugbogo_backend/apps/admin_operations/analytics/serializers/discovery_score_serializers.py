"""Administrator-facing persisted Discovery Score serializers."""

from apps.business.serializers.display_cover_photo import BusinessDisplayCoverPhotoField

from rest_framework import serializers

from apps.business.models import Business, DiscoveryScore
from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)


class DiscoveryScoreQuerySerializer(serializers.Serializer):
    """Validate score filters before they reach numeric ORM lookups."""

    search = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    cluster = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=2147483647,
    )
    category = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=2147483647,
    )
    specialty_tag = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=2147483647,
    )
    status = serializers.ChoiceField(
        choices=Business.BusinessStatus.choices,
        required=False,
        allow_blank=True,
    )
    score_state = serializers.ChoiceField(
        choices=("FAILED", "PROVISIONAL", "PENDING", "STALE", "FRESH"),
        required=False,
        allow_blank=True,
    )


class VisibilityObservationSerializer(serializers.Serializer):
    """Expose business age as a potential observation proxy only."""

    business_created_at = serializers.DateTimeField(read_only=True)
    reference_time = serializers.DateTimeField(read_only=True)
    window_days = serializers.IntegerField(read_only=True)
    potential_observation_days = serializers.FloatField(read_only=True)
    short_history = serializers.BooleanField(read_only=True)


class VisibilityGapDiagnosticSerializer(serializers.Serializer):
    """Present an on-demand calculation independently of persisted Discovery Scores."""

    business_id = serializers.IntegerField(read_only=True)
    reference_time = serializers.DateTimeField(read_only=True)
    window_start = serializers.DateTimeField(read_only=True)
    window_end = serializers.DateTimeField(read_only=True)
    observation_context = VisibilityObservationSerializer(read_only=True)
    impression_count = serializers.IntegerField(read_only=True)
    profile_visit_count = serializers.IntegerField(read_only=True)
    unique_saver_count = serializers.IntegerField(read_only=True)
    maximum_impression_count = serializers.IntegerField(read_only=True)
    maximum_profile_visit_count = serializers.IntegerField(read_only=True)
    maximum_unique_saver_count = serializers.IntegerField(read_only=True)
    normalized_impressions = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    normalized_profile_visits = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    normalized_saves = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    comparison_group_level = serializers.CharField(read_only=True)
    comparison_group_size = serializers.IntegerField(read_only=True)
    signal_weights = serializers.DictField(
        child=serializers.DecimalField(
            max_digits=6,
            decimal_places=5,
        ),
        read_only=True,
    )
    traction = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    visibility_gap = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    coverage_verified = serializers.BooleanField(read_only=True)
    telemetry_reason = serializers.CharField(read_only=True)
    telemetry_note = serializers.CharField(read_only=True)
    telemetry_coverage = serializers.DictField(read_only=True)


class DiscoveryScoreBusinessSerializer(serializers.ModelSerializer):
    """Expose concise business identity for a score row."""

    id = serializers.IntegerField(source="BUSN_ID", read_only=True)
    business_name = serializers.CharField(source="BUSN_NAME", read_only=True)
    cover_photo_url = serializers.CharField(
        source="BUSN_COVER_PHOTO_URL",
        read_only=True,
    )
    status = serializers.CharField(source="BUSN_STATUS", read_only=True)
    cluster_name = serializers.CharField(
        source="CTGRY_ID.CLUS_ID.CLUS_NAME",
        read_only=True,
    )
    category_name = serializers.CharField(
        source="CTGRY_ID.CTGRY_NAME",
        read_only=True,
    )
    specialty_tags = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = (
            "id",
            "business_name",
            "cover_photo_url",
            "status",
            "cluster_name",
            "category_name",
            "specialty_tags",
        )

    def get_specialty_tags(
        self,
        obj,
    ):
        """Return prefetched current active tags and their persisted individual scores."""

        return [
            {
                "id": link.TAG_ID.TAG_ID,
                "name": link.TAG_ID.TAG_NAME,
                "icon": link.TAG_ID.TAG_ICON,
                "color": link.TAG_ID.TAG_COLOR,
                "tag_score": format(link.BST_TAG_SCORE, "f"),
                "score_updated_at": serializers.DateTimeField().to_representation(
                    link.BST_SCORE_UPDATED_AT,
                ),
            }
            for link in obj.active_specialty_tag_links
        ]


class AdminDiscoveryScoreSerializer(serializers.ModelSerializer):
    """Keep persisted computation state separate from unverified telemetry context."""

    business = serializers.SerializerMethodField()

    def get_business(
        self,
        obj,
    ):
        """Keep business context intact while using the shared display cover preference."""
        if obj.BUSN_ID is None:
            return None
        data = DiscoveryScoreBusinessSerializer(obj.BUSN_ID, context=self.context).data
        data["cover_photo_url"] = BusinessDisplayCoverPhotoField(
            business_source="BUSN_ID",
        ).to_representation(obj)
        return data

    specialty_score = serializers.DecimalField(
        source="DSC_S_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    visibility_gap = serializers.DecimalField(
        source="DSC_V_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    discovery_score = serializers.DecimalField(
        source="DSC_D_SCORE",
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    computed_at = serializers.DateTimeField(
        source="DSC_COMPUTED_AT",
        read_only=True,
    )
    score_state = serializers.CharField(read_only=True)
    refresh_status = serializers.CharField(read_only=True)
    is_provisional = serializers.BooleanField(source="DSC_IS_PROVISIONAL", read_only=True)
    refresh_requested_at = serializers.DateTimeField(
        source="DSC_REFRESH_REQUESTED_AT",
        read_only=True,
    )
    last_attempt_at = serializers.DateTimeField(source="DSC_LAST_ATTEMPT_AT", read_only=True)
    last_error_code = serializers.CharField(source="DSC_LAST_ERROR", read_only=True)
    coverage_verified = serializers.BooleanField(default=False, read_only=True)
    telemetry_reason = serializers.CharField(
        default="coverage_unverified",
        read_only=True,
    )
    observation_context = serializers.SerializerMethodField()

    def get_observation_context(
        self,
        obj,
    ):
        """Use one request-level configuration snapshot without querying visibility events."""
        context = self.context["visibility_context"]
        observation = DiscoveryScoreMonitoringService.observation_context(
            obj.BUSN_ID,
            context["reference_time"],
            context["configuration"].DAC_VISIBILITY_WINDOW_DAYS,
        )
        return VisibilityObservationSerializer(observation).data

    class Meta:
        model = DiscoveryScore
        fields = (
            "business",
            "specialty_score",
            "visibility_gap",
            "discovery_score",
            "computed_at",
            "score_state",
            "refresh_status",
            "is_provisional",
            "refresh_requested_at",
            "last_attempt_at",
            "last_error_code",
            "coverage_verified",
            "telemetry_reason",
            "observation_context",
        )


class DiscoveryScoreBreakdownSerializer(serializers.Serializer):
    """Explain current weights applied to persisted components without claiming history."""

    specialty_weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    visibility_weight = serializers.DecimalField(
        max_digits=6,
        decimal_places=5,
        read_only=True,
    )
    weighted_specialty_contribution = serializers.DecimalField(
        max_digits=11,
        decimal_places=10,
        read_only=True,
    )
    weighted_visibility_contribution = serializers.DecimalField(
        max_digits=11,
        decimal_places=10,
        read_only=True,
    )
    basis = serializers.CharField(read_only=True)
    historical_inputs_available = serializers.BooleanField(read_only=True)
    configuration_updated_at = serializers.DateTimeField(read_only=True)
    note = serializers.CharField(read_only=True)


class AdminDiscoveryScoreDetailSerializer(AdminDiscoveryScoreSerializer):
    """Extend the persisted list contract with an explicitly current-weight breakdown."""

    score_breakdown = serializers.SerializerMethodField()

    def get_score_breakdown(
        self,
        obj,
    ):
        """Keep derived contributions at full precision and disclose unavailable snapshots."""
        configuration = self.context["visibility_context"]["configuration"]
        specialty_weight = configuration.DAC_SPECIALTY_SCORE_WEIGHT
        visibility_weight = configuration.DAC_VISIBILITY_GAP_WEIGHT
        return DiscoveryScoreBreakdownSerializer(
            {
                "specialty_weight": specialty_weight,
                "visibility_weight": visibility_weight,
                "weighted_specialty_contribution": obj.DSC_S_SCORE * specialty_weight,
                "weighted_visibility_contribution": obj.DSC_V_SCORE * visibility_weight,
                "basis": "current_weights_on_persisted_components",
                "historical_inputs_available": False,
                "configuration_updated_at": configuration.DAC_UPDATED_AT,
                "note": (
                    "Calculation inputs and observation windows are not stored as historical "
                    "snapshots. These contributions use current weights and rounded persisted "
                    "components; they may differ from the last successful calculation. "
                    "Specialty tags show current assignments and their own score timestamps."
                ),
            },
        ).data

    class Meta(AdminDiscoveryScoreSerializer.Meta):
        fields = AdminDiscoveryScoreSerializer.Meta.fields + (
            "score_breakdown",
        )
