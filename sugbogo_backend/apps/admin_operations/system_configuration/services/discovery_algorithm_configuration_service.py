from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)


class DiscoveryAlgorithmConfigurationService:
    """Provides access to the authoritative Discovery Algorithm settings."""

    SINGLETON_ID = 1

    REPUTATION_CONFIGURATION_FIELDS = (  # noqa: RUF012
        (
            "baseline_reputation",
            "DAC_REPUTATION_BASELINE",
        ),
        (
            "vouch_reputation_reward",
            "DAC_VOUCH_REPUTATION_REWARD",
        ),
        (
            "review_reputation_reward",
            "DAC_REVIEW_REPUTATION_REWARD",
        ),
        (
            "review_with_photo_reputation_reward",
            "DAC_REVIEW_PHOTO_REPUTATION_REWARD",
        ),
        (
            "approved_report_reputation_reward",
            "DAC_APPROVED_REPORT_REPUTATION_REWARD",
        ),
        (
            "confirmed_violation_reputation_penalty",
            "DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY",
        ),
    )

    @staticmethod
    @transaction.atomic
    def get_current_configuration() -> DiscoveryAlgorithmConfiguration:
        configuration, _ = (
            DiscoveryAlgorithmConfiguration.objects
            .get_or_create(
                DAC_ID=(
                    DiscoveryAlgorithmConfigurationService.SINGLETON_ID
                ),
            )
        )

        return configuration

    @staticmethod
    def get_reputation_configuration_status(
        configuration: DiscoveryAlgorithmConfiguration | None = None,
    ) -> dict:
        if configuration is None:
            configuration = (
                DiscoveryAlgorithmConfigurationService
                .get_current_configuration()
            )

        missing_fields = [
            field_name
            for field_name, model_field_name in (
                DiscoveryAlgorithmConfigurationService
                .REPUTATION_CONFIGURATION_FIELDS
            )
            if getattr(
                configuration,
                model_field_name,
            ) is None
        ]

        return {
            "is_complete": not missing_fields,
            "missing_fields": missing_fields,
        }

    @staticmethod
    def require_complete_reputation_configuration(
    ) -> DiscoveryAlgorithmConfiguration:
        configuration = (
            DiscoveryAlgorithmConfigurationService
            .get_current_configuration()
        )

        status = (
            DiscoveryAlgorithmConfigurationService
            .get_reputation_configuration_status(
                configuration,
            )
        )

        if not status["is_complete"]:
            missing_fields = ", ".join(
                status["missing_fields"],
            )

            raise ValidationError(
                {
                    "reputation_configuration": (
                        "Reputation configuration is incomplete. "
                        f"Missing: {missing_fields}."
                    ),
                },
            )

        return configuration
