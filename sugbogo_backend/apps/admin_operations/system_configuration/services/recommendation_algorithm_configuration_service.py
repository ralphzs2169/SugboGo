from django.db import transaction

from apps.admin_operations.system_configuration.models import (
    RecommendationAlgorithmConfiguration,
)


class RecommendationAlgorithmConfigurationService:
    """Provides one authoritative recommendation configuration snapshot."""

    SINGLETON_ID = 1

    @staticmethod
    @transaction.atomic
    def get_current_configuration() -> RecommendationAlgorithmConfiguration:
        configuration, _ = (
            RecommendationAlgorithmConfiguration.objects.get_or_create(
                RAC_ID=(
                    RecommendationAlgorithmConfigurationService.SINGLETON_ID
                ),
            )
        )

        return configuration
