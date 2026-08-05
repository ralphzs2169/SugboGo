from django.db import transaction

from apps.merchant_application.models import MerchantApplicationOperatingHours
from apps.merchant_application.services.application_service import ApplicationService


class OperatingHoursService:
    STEP = 3

    @staticmethod
    @transaction.atomic
    def save_hours(application, hours_list):
        """
        Saves the application's complete weekly operating hours
        and marks Step 3 as completed.
        """

        ApplicationService.validate_step_access(
            application,
            OperatingHoursService.STEP,
        )

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

        # Mark Step 3 as completed on the parent application.
        ApplicationService.mark_step_completed(
            application,
            OperatingHoursService.STEP,
        )

        return hours