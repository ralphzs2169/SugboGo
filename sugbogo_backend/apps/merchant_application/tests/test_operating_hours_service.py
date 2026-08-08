# isort: skip_file
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