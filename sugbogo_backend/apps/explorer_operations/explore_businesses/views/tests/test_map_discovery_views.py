from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.models import (
    BusinessPhoto,
    BusinessSpecialtyTag,
    Category,
    SpecialtyTag,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.map_discovery_test_mixin import MapDiscoveryTestMixin
from ...services.tests import test_map_discovery_filters as map_filter_tests


class MapDiscoveryViewTests(
    MapDiscoveryTestMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Cover viewport API validation, compact responses, permissions, and query bounds."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.explorer)
        self.url = reverse("map-discovery")

    def test_returns_compact_public_preview_and_active_specialties(self):
        business = self.create_business()
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Map Coffee",
            TAG_COLOR=SpecialtyTag.TagColor.BLUE,
            TAG_ICON=SpecialtyTag.TagIcon.COFFEE,
        )
        inactive_tag = SpecialtyTag.objects.create(
            TAG_NAME="Inactive Map Specialty",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=inactive_tag,
            BST_IS_ACTIVE=False,
        )

        response = self.client.get(self.url, self.bounds)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(self.url, "/api/explorer/explore/map/")
        self.assertEqual(
            response.data["data"]["items"],
            [
                {
                    "id": business.BUSN_ID,
                    "business_name": business.BUSN_NAME,
                    "cover_photo_url": None,
                    "display_cover_photo_url": None,
                    "cluster": {
                        "id": self.cluster.CLUS_ID,
                        "name": self.cluster.CLUS_NAME,
                        "icon": "coffee",
                    },
                    "category": {
                        "id": self.category.CTGRY_ID,
                        "name": self.category.CTGRY_NAME,
                    },
                    "location": {
                        "address": "Map Street",
                        "city": "Cebu City",
                        "province": "Cebu",
                        "latitude": 10.3,
                        "longitude": 123.9,
                    },
                    "specialty_tags": [
                        {
                            "id": tag.TAG_ID,
                            "name": tag.TAG_NAME,
                            "color": "blue",
                            "icon": "coffee",
                        },
                    ],
                    "is_hidden_gem": False,
                },
            ],
        )

    def test_cover_photo_uses_existing_storefront_fallback(self):
        business = self.create_business()
        BusinessPhoto.objects.create(
            BUSN_ID=business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
            BPHO_PHOTO_URL="https://example.com/storefront.jpg",
            BPHO_PHOTO_PUBLIC_ID="map-storefront",
        )

        response = self.client.get(self.url, self.bounds)
        item = response.data["data"]["items"][0]

        self.assertIsNone(item["cover_photo_url"])
        self.assertEqual(
            item["display_cover_photo_url"],
            "https://example.com/storefront.jpg",
        )
        business.BUSN_COVER_PHOTO_URL = "https://example.com/cover.jpg"
        business.save(update_fields=["BUSN_COVER_PHOTO_URL"])

        response = self.client.get(self.url, self.bounds)
        item = response.data["data"]["items"][0]

        self.assertEqual(item["cover_photo_url"], business.BUSN_COVER_PHOTO_URL)
        self.assertEqual(
            item["display_cover_photo_url"],
            business.BUSN_COVER_PHOTO_URL,
        )

    def test_missing_coordinates_return_controlled_errors_without_database_queries(self):
        for field in self.bounds:
            params = dict(self.bounds)
            del params[field]

            with self.subTest(field=field):
                with self.assertNumQueries(0):
                    response = self.client.get(self.url, params)
                self.assertValidationError(response, field)

    def test_invalid_and_nonfinite_coordinates_return_controlled_errors(self):
        for field, value in (
            ("north", "invalid"),
            ("north", ""),
            ("north", 91),
            ("south", -91),
            ("east", 181),
            ("west", -181),
            ("north", "NaN"),
            ("south", "NaN"),
            ("east", "NaN"),
            ("west", "NaN"),
            ("north", "Infinity"),
            ("west", "-Infinity"),
        ):
            with self.subTest(field=field, value=value):
                with self.assertNumQueries(0):
                    response = self.client.get(
                        self.url,
                        {
                            **self.bounds,
                            field: value,
                        },
                    )
                self.assertValidationError(response, field)

    def test_inverted_degenerate_and_antimeridian_bounds_are_rejected(self):
        for overrides, error_field in (
            ({"north": 10.1}, "north"),
            ({"north": 10.2}, "north"),
            ({"east": 123.7}, "east"),
            ({"east": 123.8}, "east"),
            ({"west": 179.9, "east": -179.9}, "east"),
        ):
            with self.subTest(overrides=overrides):
                response = self.client.get(
                    self.url,
                    {
                        **self.bounds,
                        **overrides,
                    },
                )
                self.assertValidationError(response, error_field)

    def test_oversized_viewports_are_rejected_on_either_axis(self):
        for overrides in (
            {"north": 10.8},
            {"east": 124.4},
        ):
            with self.subTest(overrides=overrides):
                response = self.client.get(
                    self.url,
                    {
                        **self.bounds,
                        **overrides,
                    },
                )
                self.assertValidationError(response, "bounds")

    @override_settings(MAP_DISCOVERY_MAX_VIEWPORT_SPAN=0.1)
    def test_viewport_span_uses_configured_limit(self):
        response = self.client.get(self.url, self.bounds)

        self.assertValidationError(response, "bounds")

    @override_settings(MAP_DISCOVERY_MAX_MARKERS=2)
    def test_marker_cap_exposes_total_and_has_next_and_allows_remaining_pages(self):
        businesses = [
            self.create_business()
            for _ in range(3)
        ]

        response = self.client.get(self.url, self.bounds)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [business.BUSN_ID for business in businesses[:2]],
        )
        self.assertEqual(
            response.data["data"]["pagination"],
            {
                "page": 1,
                "page_size": 2,
                "total_items": 3,
                "total_pages": 2,
                "has_next": True,
                "has_previous": False,
            },
        )
        second_page = self.client.get(
            self.url,
            {
                **self.bounds,
                "page": 2,
            },
        )
        self.assertEqual(
            [item["id"] for item in second_page.data["data"]["items"]],
            [businesses[2].BUSN_ID],
        )
        self.assertFalse(second_page.data["data"]["pagination"]["has_next"])

        oversized_page = self.client.get(
            self.url,
            {
                **self.bounds,
                "page_size": 999,
            },
        )
        self.assertEqual(len(oversized_page.data["data"]["items"]), 2)
        self.assertTrue(oversized_page.data["data"]["pagination"]["has_next"])

    def test_map_gems_match_explore_homepage_when_higher_ranked_gems_are_outside(self):
        for index in range(11):
            if index < 5:
                latitude = 10.45
            else:
                latitude = 10.3

            self.create_business(
                latitude=latitude,
                score=str((100 - index) / 100),
            )

        homepage = self.client.get(
            "/api/explorer/explore/collections/hidden-gems/",
        )
        homepage_ids = {
            item["id"]
            for item in homepage.data["data"]["items"]
        }
        response = self.client.get(self.url, self.bounds)
        items = response.data["data"]["items"]

        self.assertEqual(len(homepage_ids), 10)
        self.assertEqual(len(items), 6)
        self.assertEqual(sum(item["is_hidden_gem"] for item in items), 5)
        for item in items:
            self.assertEqual(item["is_hidden_gem"], item["id"] in homepage_ids)
        self.assertNotIn("score", response.content.decode().lower())

    def test_empty_viewport_returns_successful_empty_page(self):
        self.create_business(
            latitude=11.0,
        )

        response = self.client.get(self.url, self.bounds)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        self.assertFalse(response.data["data"]["pagination"]["has_next"])

    def test_query_count_is_constant_as_markers_and_specialties_grow(self):
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Map Query Count",
        )

        for target_count in (1, 12):
            while self.business_number < target_count:
                business = self.create_business()
                BusinessSpecialtyTag.objects.create(
                    BUSN_ID=business,
                    TAG_ID=tag,
                )

            with self.subTest(marker_count=target_count):
                with self.assertNumQueries(3):
                    response = self.client.get(self.url, self.bounds)
                self.assertEqual(len(response.data["data"]["items"]), target_count)

    def test_authentication_and_explorer_or_merchant_role_are_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url, self.bounds)
        self.assertAuthenticationError(response, code="NOT_AUTHENTICATED")

        self.explorer.USER_ROLE = User.UserRole.ADMIN
        self.client.force_authenticate(self.explorer)
        response = self.client.get(self.url, self.bounds)
        self.assertEqual(response.status_code, 403)

        self.explorer.USER_ROLE = User.UserRole.MERCHANT
        response = self.client.get(self.url, self.bounds)
        self.assertSuccessResponse(response, message="Success.")


class MapDirectoryViewTests(MapDiscoveryTestMixin, APITestCase):
    """Exercise global directory coverage, stable pages, and shared compact queries."""

    def setUp(self):
        """Authenticate the same Explorer role as viewport discovery."""
        super().setUp()
        self.client.force_authenticate(self.explorer)
        self.url = reverse("map-directory")

    @override_settings(MAP_DISCOVERY_MAX_MARKERS=2)
    def test_global_pages_keep_id_order_and_exclude_suspended_businesses(self):
        first = self.create_business(
            latitude=11.2,
        )
        second = self.create_business(
            longitude=125,
            score="1.00000",
        )
        third = self.create_business()
        self.create_business(status_value="suspended")

        first_page = self.client.get(self.url)
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(
            [
                item["id"]
                for item in first_page.data["data"]["items"]
            ],
            [first.BUSN_ID, second.BUSN_ID],
        )
        self.assertTrue(first_page.data["data"]["pagination"]["has_next"])
        self.assertEqual(
            first_page.data["data"]["pagination"]["total_items"],
            3,
        )
        second_page = self.client.get(
            self.url,
            {"page": 2},
        )
        self.assertEqual(
            [
                item["id"]
                for item in second_page.data["data"]["items"]
            ],
            [third.BUSN_ID],
        )
        self.assertFalse(second_page.data["data"]["pagination"]["has_next"])
        self.assertTrue(first_page.data["data"]["items"][1]["is_hidden_gem"])

    def test_global_serialization_retains_three_queries_and_compact_contract(self):
        self.create_business()
        self.create_business(latitude=11)
        with self.assertNumQueries(3):
            response = self.client.get(self.url)
        item = response.data["data"]["items"][0]
        self.assertEqual(
            set(item),
            {
                "id",
                "business_name",
                "cover_photo_url",
                "display_cover_photo_url",
                "cluster",
                "category",
                "location",
                "specialty_tags",
                "is_hidden_gem",
            },
        )

    def test_global_route_preserves_permissions_and_empty_response(self):
        response = self.client.get(self.url)
        self.assertEqual(
            response.data["data"]["items"],
            [],
        )
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.explorer.USER_ROLE = User.UserRole.ADMIN
        self.client.force_authenticate(self.explorer)
        self.assertEqual(self.client.get(self.url).status_code, 403)


class MapDirectoryFilterTests(map_filter_tests.MapDiscoveryFilterTests):
    """Apply the existing taxonomy, global gem, and overnight-hour tests to the directory."""

    def setUp(self):
        """Run the shared filter fixtures through the global route without bounds."""
        super().setUp()
        self.url = reverse("map-directory")
        self.bounds = {}

    def test_filters_do_not_promote_an_outsider_into_global_gems(self):
        """Keep global membership when taxonomy excludes the higher-ranked gems."""
        for _ in range(10):
            self.create_business(
                score="1.00000",
            )
        outsider = self.create_business(
            score="0.10000",
        )
        category = Category.objects.create(
            CTGRY_NAME="Directory Outsider",
            CLUS_ID=self.cluster,
        )
        outsider.CTGRY_ID = category
        outsider.save()
        self.assertEqual(
            self.result_ids(
                category=[category.CTGRY_ID],
                hidden_gems=True,
            ),
            [],
        )
        self.assertEqual(
            self.result_ids(
                category=[category.CTGRY_ID],
            ),
            [outsider.BUSN_ID],
        )
