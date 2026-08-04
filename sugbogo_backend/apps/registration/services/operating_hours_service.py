from django.db import transaction

from apps.registration.models import MerchantApplicationOperatingHours
from apps.registration.services.application_service import ApplicationService


class OperatingHoursService:
    STEP = 3

    @staticmethod
    @transaction.atomic
    def replace_hours(application, hours_list):
        """
        Step 3. Replaces the application's full week of operating hours
        in one call — deletes existing rows, then bulk-creates the new
        set, rather than trying to diff/update individual days.
        """

        MerchantApplicationOperatingHours.objects.filter(
            MAPP_ID=application
        ).delete()

        records = [
            MerchantApplicationOperatingHours(
                MAPP_ID=application,
                MHRS_DAY=item["day"],
                MHRS_IS_OPEN=item["is_open"],
                MHRS_IS_24_HOURS=item.get("is_24_hours", False),
                MHRS_OPEN_TIME=item.get("open_time"),
                MHRS_CLOSE_TIME=item.get("close_time"),
            )
            for item in hours_list
        ]

        hours = MerchantApplicationOperatingHours.objects.bulk_create(records)

        ApplicationService.mark_step_completed(
            application,
            OperatingHoursService.STEP,
        )

        return hours