from django.utils import timezone

from apps.business.models import Business


class BusinessAvailabilityService:
    """Expose only the active-listing eligibility already observable through public details."""

    @staticmethod
    def check(
        business_ids,
    ):
        """Use one bounded SQL query and treat absent and restricted records identically."""
        ids = list(dict.fromkeys(business_ids))
        active_ids = set(
            Business.objects.filter(
                pk__in=ids,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            ).values_list("pk", flat=True)
        )
        return {
            "checked_at": timezone.now().isoformat(),
            "items": [
                {
                    "business_id": business_id,
                    "availability": (
                        "available"
                        if business_id in active_ids
                        else "unavailable"
                    ),
                }
                for business_id in ids
            ],
        }
