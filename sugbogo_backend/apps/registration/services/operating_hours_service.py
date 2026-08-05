from django.db import transaction

from apps.registration.models import MerchantApplicationOperatingHours


class OperatingHoursService:
    @staticmethod
    @transaction.atomic
    def replace_hours(application, hours_list, current_step, highest_completed_step):
        """
        Step 4. Replaces the application's full week of operating hours
        in one call — deletes existing rows, then bulk-creates the new
        set, rather than trying to diff/update individual days.
        """
        application.MAPP_CURRENT_STEP = current_step
        application.MAPP_HIGHEST_COMPLETED_STEP = highest_completed_step
        application.save(
            update_fields=[
                "MAPP_CURRENT_STEP",
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
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

        return MerchantApplicationOperatingHours.objects.bulk_create(records)