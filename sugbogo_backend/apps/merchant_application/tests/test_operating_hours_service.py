# isort: skip_file
from datetime import time

from django.test import TestCase

from apps.merchant_application.models import MerchantApplicationOperatingHours
from apps.merchant_application.services.operating_hours_service import (
    OperatingHoursService,
)
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class OperatingHoursServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_save_hours_creates_seven_records_and_marks_step_complete(self):
        application, _ = self._create_identity()
        self._create_location(application)

        hours = OperatingHoursService.save_hours(
            application,
            self._hours_payload(),
        )

        application.refresh_from_db()

        self.assertEqual(
            len(hours),
            7,
        )

        self.assertEqual(
            MerchantApplicationOperatingHours.objects.filter(
                MAPP_ID=application,
            ).count(),
            7,
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            3,
        )

    def test_save_hours_replaces_existing_weekly_schedule(self):
        application, _ = self._create_identity()
        self._create_location(application)

        OperatingHoursService.save_hours(
            application,
            self._hours_payload(),
        )

        updated_hours = [
            {
                "day": MerchantApplicationOperatingHours.Day.MONDAY,
                "is_open": False,
                "is_24_hours": False,
                "open_time": None,
                "close_time": None,
            },
            {
                "day": MerchantApplicationOperatingHours.Day.TUESDAY,
                "is_open": True,
                "is_24_hours": True,
                "open_time": None,
                "close_time": None,
            },
            {
                "day": MerchantApplicationOperatingHours.Day.WEDNESDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(10, 0),
                "close_time": time(19, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.THURSDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(10, 0),
                "close_time": time(19, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.FRIDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(10, 0),
                "close_time": time(19, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.SATURDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(11, 0),
                "close_time": time(20, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.SUNDAY,
                "is_open": False,
                "is_24_hours": False,
                "open_time": None,
                "close_time": None,
            },
        ]

        hours = OperatingHoursService.save_hours(
            application,
            updated_hours,
        )

        application.refresh_from_db()

        self.assertEqual(
            len(hours),
            7,
        )

        self.assertEqual(
            MerchantApplicationOperatingHours.objects.filter(
                MAPP_ID=application,
            ).count(),
            7,
        )

        monday = MerchantApplicationOperatingHours.objects.get(
            MAPP_ID=application,
            MHRS_DAY=MerchantApplicationOperatingHours.Day.MONDAY,
        )

        self.assertFalse(monday.MHRS_IS_OPEN)

        tuesday = MerchantApplicationOperatingHours.objects.get(
            MAPP_ID=application,
            MHRS_DAY=MerchantApplicationOperatingHours.Day.TUESDAY,
        )

        self.assertTrue(tuesday.MHRS_IS_24_HOURS)

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            3,
        )