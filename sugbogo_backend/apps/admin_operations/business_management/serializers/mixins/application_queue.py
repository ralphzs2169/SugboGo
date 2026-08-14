from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.utils.application_queue import (
    count_business_days,
    get_application_queue_status,
)
from django.utils import timezone
from rest_framework import serializers


class ApplicationQueueSerializerMixin(serializers.Serializer):
    """
    Provides shared application review queue metrics.
    """

    time_in_queue_business_days = serializers.SerializerMethodField()
    queue_status = serializers.SerializerMethodField()

    def _get_resolved_at(self, application):
        """
        Return the review timestamp for approved or rejected applications.
        """

        if application.MAPP_STATUS not in (
            MerchantApplication.ApplicationStatus.APPROVED,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            return None

        return application.MAPP_REVIEWED_AT

    def get_time_in_queue_business_days(self, application):
        """
        Calculate the business days spent in the application review queue.
        """

        submitted_at = application.MAPP_SUBMITTED_AT

        if not submitted_at:
            return None

        resolved_at = self._get_resolved_at(application)

        return count_business_days(
            submitted_at,
            resolved_at or timezone.now(),
        )

    def get_queue_status(self, application):
        """
        Determine the application's current review queue status.
        """

        submitted_at = application.MAPP_SUBMITTED_AT

        if not submitted_at:
            return None

        return get_application_queue_status(
            submitted_at,
            self._get_resolved_at(application),
        )