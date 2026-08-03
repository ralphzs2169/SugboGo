from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.tests.assertions import APIResponseAssertionsMixin


class CategoryOptionsViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the category options endpoint."""

    def setUp(self):
        self.url = reverse("category-options")

    @patch(
        "apps.registration.views.category_options_views.CategoryService.list_categories"
    )
    def test_returns_category_options_successfully(
        self,
        mock_list_categories,
    ):
        mock_list_categories.return_value = []

        response = self.client.get(self.url)

        self.assertSuccessResponse(
            response,
            message="Categories retrieved successfully.",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"],
            [],
        )

        mock_list_categories.assert_called_once_with()