"""Protect the lean business list and optional application linkage."""

from django.test import TestCase

from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.admin_operations.business_management.serializers.manage_business_serializers import (
    AdminBusinessListSerializer,
)


class BusinessListContractTests(DashboardFixtures, TestCase):
    def test_list_omits_specialties_and_preserves_owner_and_optional_application(self):
        business = self.create_business()
        application = self.create_application()
        application.BUSN_ID = business
        application.save(update_fields=["BUSN_ID"])
        self.create_business()

        with self.assertNumQueries(1):
            rows = AdminBusinessListSerializer(
                BusinessService.list_businesses(),
                many=True,
            ).data

        linked = next(row for row in rows if row["id"] == business.pk)
        self.assertEqual(linked["application_id"], application.pk)
        for row in rows:
            self.assertNotIn("specialty_tags", row)
            self.assertIn("owner", row)
            self.assertIn("vouch_count", row)
        self.assertTrue(any(row["application_id"] is None for row in rows))
