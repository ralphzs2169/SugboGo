from unittest.mock import patch

from apps.business.models import SpecialtyTag
from apps.explorer_operations.explore_businesses.views.explore_specialty_tag_views import (
    ExploreSpecialtyView,
)
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory


class ExploreSpecialtyViewTests(SimpleTestCase):
    """Tests the Explorer Specialty Tag shortcut endpoint response."""

    def setUp(self):
        self.factory = APIRequestFactory()

    def make_specialty(
        self,
        tag_id,
        name,
        color="blue",
        icon="tag",
        business_count=1,
    ):
        specialty = SpecialtyTag(
            TAG_ID=tag_id,
            TAG_NAME=name,
            TAG_COLOR=color,
            TAG_ICON=icon,
        )

        specialty.business_count = business_count

        return specialty

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_specialty_tag_views.ExploreSpecialtyService.list_specialties",
    )
    def test_returns_serialized_explore_specialties(
        self,
        mock_list_specialties,
    ):
        mock_list_specialties.return_value = [
            self.make_specialty(
                tag_id=1,
                name="Local Coffee",
                color="yellow",
                icon="coffee",
                business_count=8,
            ),
            self.make_specialty(
                tag_id=2,
                name="Handmade Crafts",
                color="purple",
                icon="palette",
                business_count=4,
            ),
        ]

        request = self.factory.get("/explorer/explore/specialties/")

        response = ExploreSpecialtyView().get(request)

        self.assertEqual(response.status_code, 200)

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["message"],
            "Explore specialties retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            [
                {
                    "id": 1,
                    "name": "Local Coffee",
                    "color": "yellow",
                    "icon": "coffee",
                    "business_count": 8,
                },
                {
                    "id": 2,
                    "name": "Handmade Crafts",
                    "color": "purple",
                    "icon": "palette",
                    "business_count": 4,
                },
            ],
        )

        mock_list_specialties.assert_called_once_with()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "explore_specialty_tag_views.ExploreSpecialtyService.list_specialties",
    )
    def test_returns_successful_empty_list_when_no_specialties_exist(
        self,
        mock_list_specialties,
    ):
        mock_list_specialties.return_value = []

        request = self.factory.get("/explorer/explore/specialties/")

        response = ExploreSpecialtyView().get(request)

        self.assertEqual(response.status_code, 200)

        self.assertTrue(response.data["success"])

        self.assertEqual(
            response.data["data"],
            [],
        )

        mock_list_specialties.assert_called_once_with()