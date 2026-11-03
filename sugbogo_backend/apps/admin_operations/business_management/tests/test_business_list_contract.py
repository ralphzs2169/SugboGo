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

    def test_map_image_fallback_and_filters_remain_one_query(self):
        from apps.business.models import BusinessPhoto
        from apps.admin_operations.business_management.serializers.manage_business_serializers import AdminBusinessMapSerializer

        preferred = self.create_business()
        preferred.BUSN_COVER_PHOTO_URL = "https://example.com/cover.jpg"
        preferred.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        fallback = self.create_business()
        missing = self.create_business()
        for business in (preferred, fallback):
            BusinessPhoto.objects.create(
                BUSN_ID=business,
                BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
                BPHO_PHOTO_URL="https://example.com/storefront.jpg",
                BPHO_PHOTO_PUBLIC_ID=f"storefront-{business.pk}",
            )
        with self.assertNumQueries(1):
            rows = AdminBusinessMapSerializer(
                BusinessService.list_business_locations(),
                many=True,
            ).data
        photos = {
            row["id"]: row["cover_photo_url"]
            for row in rows
        }
        self.assertEqual(photos[preferred.pk], "https://example.com/cover.jpg")
        self.assertEqual(photos[fallback.pk], "https://example.com/storefront.jpg")
        self.assertIsNone(photos[missing.pk])
        fallback.BUSN_STATUS = "suspended"
        fallback.save(update_fields=["BUSN_STATUS"])
        filtered = BusinessService.list_business_locations(
            search=fallback.BUSN_NAME,
            status="suspended",
        )
        self.assertEqual(list(filtered), [fallback])
