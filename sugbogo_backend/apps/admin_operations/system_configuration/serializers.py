from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)


class DiscoveryAlgorithmConfigurationSerializer(serializers.ModelSerializer):
    """Validates typed Discovery Algorithm configuration values."""

    specialty_score_weight = serializers.DecimalField(
        source="DAC_SPECIALTY_SCORE_WEIGHT",
        max_digits=6,
        decimal_places=5,
    )
    visibility_gap_weight = serializers.DecimalField(
        source="DAC_VISIBILITY_GAP_WEIGHT",
        max_digits=6,
        decimal_places=5,
    )
    decay_rate = serializers.DecimalField(
        source="DAC_DECAY_RATE",
        max_digits=6,
        decimal_places=5,
    )
    vouch_only_confidence = serializers.DecimalField(
        source="DAC_VOUCH_ONLY_CONFIDENCE",
        max_digits=6,
        decimal_places=5,
    )
    vouch_review_confidence = serializers.DecimalField(
        source="DAC_VOUCH_REVIEW_CONFIDENCE",
        max_digits=6,
        decimal_places=5,
    )
    vouch_review_photo_confidence = serializers.DecimalField(
        source="DAC_VOUCH_REVIEW_PHOTO_CONFIDENCE",
        max_digits=6,
        decimal_places=5,
    )
    reputation_baseline = serializers.DecimalField(
        source="DAC_REPUTATION_BASELINE",
        max_digits=6,
        decimal_places=5,
    )
    vouch_reputation_reward = serializers.DecimalField(
        source="DAC_VOUCH_REPUTATION_REWARD",
        max_digits=6,
        decimal_places=5,
    )
    review_reputation_reward = serializers.DecimalField(
        source="DAC_REVIEW_REPUTATION_REWARD",
        max_digits=6,
        decimal_places=5,
    )
    review_photo_reputation_reward = serializers.DecimalField(
        source="DAC_REVIEW_PHOTO_REPUTATION_REWARD",
        max_digits=6,
        decimal_places=5,
    )
    approved_report_reputation_reward = serializers.DecimalField(
        source="DAC_APPROVED_REPORT_REPUTATION_REWARD",
        max_digits=6,
        decimal_places=5,
    )
    confirmed_violation_reputation_penalty = serializers.DecimalField(
        source="DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY",
        max_digits=6,
        decimal_places=5,
    )
    vouch_only_reputation_cap = serializers.DecimalField(
        source="DAC_VOUCH_ONLY_REPUTATION_CAP",
        max_digits=6,
        decimal_places=5,
    )
    minimum_category_comparison_size = serializers.IntegerField(
        source="DAC_MIN_CATEGORY_COMPARISON_SIZE",
    )
    minimum_cluster_comparison_size = serializers.IntegerField(
        source="DAC_MIN_CLUSTER_COMPARISON_SIZE",
    )
    visibility_window_days = serializers.IntegerField(
        source="DAC_VISIBILITY_WINDOW_DAYS",
    )
    impression_weight = serializers.DecimalField(
        source="DAC_IMPRESSION_WEIGHT",
        max_digits=6,
        decimal_places=5,
    )
    profile_visit_weight = serializers.DecimalField(
        source="DAC_PROFILE_VISIT_WEIGHT",
        max_digits=6,
        decimal_places=5,
    )
    save_weight = serializers.DecimalField(
        source="DAC_SAVE_WEIGHT",
        max_digits=6,
        decimal_places=5,
    )

    class Meta:
        model = DiscoveryAlgorithmConfiguration
        fields = (
            "specialty_score_weight",
            "visibility_gap_weight",
            "decay_rate",
            "vouch_only_confidence",
            "vouch_review_confidence",
            "vouch_review_photo_confidence",
            "reputation_baseline",
            "vouch_reputation_reward",
            "review_reputation_reward",
            "review_photo_reputation_reward",
            "approved_report_reputation_reward",
            "confirmed_violation_reputation_penalty",
            "vouch_only_reputation_cap",
            "minimum_category_comparison_size",
            "minimum_cluster_comparison_size",
            "visibility_window_days",
            "impression_weight",
            "profile_visit_weight",
            "save_weight",
        )

    def validate(self, attrs):
        candidate = DiscoveryAlgorithmConfiguration()

        if self.instance is not None:
            editable_fields = [
                field
                for field in DiscoveryAlgorithmConfiguration._meta.fields
                if field.name not in {
                    "DAC_ID",
                    "DAC_CREATED_AT",
                    "DAC_UPDATED_AT",
                }
            ]

            for field in editable_fields:
                setattr(
                    candidate,
                    field.name,
                    getattr(
                        self.instance,
                        field.name,
                    ),
                )

        for field_name, value in attrs.items():
            setattr(
                candidate,
                field_name,
                value,
            )

        try:
            candidate.full_clean(
                validate_unique=False,
                validate_constraints=False,
            )
        except DjangoValidationError as exc:
            public_field_names = {
                field.source: field_name
                for field_name, field in self.fields.items()
            }

            errors = {
                public_field_names.get(
                    field_name,
                    field_name,
                ): messages
                for field_name, messages in exc.message_dict.items()
            }

            raise serializers.ValidationError(
                errors,
            )

        return attrs
