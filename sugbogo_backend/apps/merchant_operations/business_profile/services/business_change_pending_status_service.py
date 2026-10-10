from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)


class BusinessChangePendingStatusService:
    """Returns pending request flags without loading request histories."""

    @staticmethod
    def for_merchant(user):
        """Check the authenticated merchant's three request types."""
        try:
            business = (
                Business.objects
                .only("BUSN_ID")
                .get(USER_ID=user)
            )
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

        return {
            "business_name": BusinessNameChangeRequest.objects.filter(
                BUSN_ID=business,
                BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
            ).exists(),
            "classification": BusinessClassificationChangeRequest.objects.filter(
                BUSN_ID=business,
                BCCR_STATUS=BusinessClassificationChangeRequest.Status.PENDING,
            ).exists(),
            "location": BusinessLocationChangeRequest.objects.filter(
                BUSN_ID=business,
                BLCR_STATUS=BusinessLocationChangeRequest.Status.PENDING,
            ).exists(),
        }
