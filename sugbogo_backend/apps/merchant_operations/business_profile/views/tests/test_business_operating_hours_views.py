from datetime import time

from apps.business.models import (
    Business,
    BusinessOperatingHours,
    Category,
    Cluster,
    Location,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.test import APIClient


class BusinessOperatingHoursViewTests(TestCase):
    """Exercise complete owner-only updates to approved business hours."""

    def setUp(self):
        """Create an active merchant with an existing full weekly schedule."""

        self.client = APIClient()
        self.url = "/api/merchant/business-profile/operating-hours/"
        self.merchant = User.objects.create_user(
            email="hours-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food and Dining")
        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu restaurant",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.original_ids = {}

        for day in BusinessOperatingHours.Day.values:
            schedule = BusinessOperatingHours.objects.create(
                BUSN_ID=self.business,
                BOHR_DAY=day,
                BOHR_IS_OPEN=True,
                BOHR_OPEN_TIME=time(8, 0),
                BOHR_CLOSE_TIME=time(17, 0),
            )
            self.original_ids[day] = schedule.BOHR_ID

        self.client.force_authenticate(user=self.merchant)

    def _hours(self):
        """Build a valid full-week payload with ordinary daytime hours."""

        return [
            {
                "day": day,
                "is_open": True,
                "is_24_hours": False,
                "open_time": "09:00",
                "close_time": "18:00",
            }
            for day in BusinessOperatingHours.Day.values
        ]

    def _put(self, hours):
        """Submit one weekly schedule through the merchant endpoint."""

        return self.client.put(
            self.url,
            {"hours": hours},
            format="json",
        )

    def test_valid_week_updates_existing_rows_and_preserves_ids(self):
        """Persist ordinary hours without replacing approved row identities."""

        response = self._put(self._hours())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 7)
        self.assertEqual(
            BusinessOperatingHours.objects.filter(BUSN_ID=self.business).count(),
            7,
        )

        for schedule in self.business.operating_hours.all():
            self.assertEqual(schedule.BOHR_ID, self.original_ids[schedule.BOHR_DAY])
            self.assertEqual(schedule.BOHR_OPEN_TIME, time(9, 0))
            self.assertEqual(schedule.BOHR_CLOSE_TIME, time(18, 0))

    def test_closed_24_hour_and_overnight_days_persist(self):
        """Normalize closed and all-day rows while permitting overnight hours."""

        hours = self._hours()
        hours[0].update(
            is_open=False,
            is_24_hours=True,
            open_time="09:00",
            close_time="18:00",
        )
        hours[1].update(
            is_24_hours=True,
            open_time="09:00",
            close_time="18:00",
        )
        hours[2].update(open_time="22:00", close_time="02:00")

        response = self._put(hours)

        self.assertEqual(response.status_code, 200)
        monday = self.business.operating_hours.get(BOHR_DAY="monday")
        tuesday = self.business.operating_hours.get(BOHR_DAY="tuesday")
        wednesday = self.business.operating_hours.get(BOHR_DAY="wednesday")
        self.assertFalse(monday.BOHR_IS_OPEN)
        self.assertFalse(monday.BOHR_IS_24_HOURS)
        self.assertIsNone(monday.BOHR_OPEN_TIME)
        self.assertIsNone(monday.BOHR_CLOSE_TIME)
        self.assertTrue(tuesday.BOHR_IS_24_HOURS)
        self.assertIsNone(tuesday.BOHR_OPEN_TIME)
        self.assertIsNone(tuesday.BOHR_CLOSE_TIME)
        self.assertEqual(wednesday.BOHR_OPEN_TIME, time(22, 0))
        self.assertEqual(wednesday.BOHR_CLOSE_TIME, time(2, 0))

    def test_invalid_weeks_do_not_partially_persist(self):
        """Reject missing, duplicate, all-closed, and equal-time schedules."""

        missing = self._hours()[:-1]
        duplicate = self._hours()
        duplicate[-1]["day"] = "monday"
        closed = self._hours()

        for item in closed:
            item["is_open"] = False

        equal = self._hours()
        equal[3]["close_time"] = "09:00"

        for hours in (missing, duplicate, closed, equal):
            with self.subTest(hours=hours):
                response = self._put(hours)

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                for schedule in self.business.operating_hours.all():
                    self.assertEqual(schedule.BOHR_OPEN_TIME, time(8, 0))
                    self.assertEqual(schedule.BOHR_CLOSE_TIME, time(17, 0))

    def test_suspended_business_cannot_update(self):
        """Reject updates while leaving suspended hours readable."""

        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])

        response = self._put(self._hours())

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["message"],
            "Operating hours cannot be edited while your business is suspended.",
        )
        self.assertEqual(
            self.business.operating_hours.get(BOHR_DAY="monday").BOHR_OPEN_TIME,
            time(8, 0),
        )

    def test_missing_owned_business_cannot_update_another_business(self):
        """Return a controlled 404 when the merchant owns no business."""

        other_merchant = User.objects.create_user(
            email="other-hours-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(user=other_merchant)

        response = self._put(self._hours())

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.data["message"],
            "Your business could not be found.",
        )
        self.assertEqual(
            self.business.operating_hours.get(BOHR_DAY="monday").BOHR_OPEN_TIME,
            time(8, 0),
        )

        targeted_response = self.client.put(
            self.url,
            {"business_id": self.business.BUSN_ID, "hours": self._hours()},
            format="json",
        )
        self.assertEqual(targeted_response.status_code, 400)
        self.assertIn("business_id", targeted_response.data["errors"])
