from rest_framework import status
from rest_framework.test import APITestCase

from apps.msme.models import SpecialtyTag
from apps.users.models import User


class SpecialtyTagViewTests(APITestCase):
    """Tests for Specialty Tag CRUD API endpoints."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="testpassword",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Admin",
            USER_LNAME="User",
        )

        self.client.force_authenticate(user=self.admin)

        self.tag = SpecialtyTag.objects.create(
            TAG_NAME="Eco Friendly",
        )

        self.other_tag = SpecialtyTag.objects.create(
            TAG_NAME="White Sand",
        )

    def test_list_specialty_tags_returns_tags(self):
        response = self.client.get(
            "/api/admin/msmes/specialty-tags/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            2,
        )

        self.assertEqual(
            len(response.data["data"]["items"]),
            2,
        )

    def test_list_specialty_tags_filters_by_search(self):
        response = self.client.get(
            "/api/admin/msmes/specialty-tags/?search=eco",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            1,
        )

        self.assertEqual(
            response.data["data"]["items"][0]["TAG_NAME"],
            "Eco Friendly",
        )

    def test_list_specialty_tags_orders_by_name_descending(self):
        response = self.client.get(
            "/api/admin/msmes/specialty-tags/?ordering=-name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            item["TAG_NAME"]
            for item in response.data["data"]["items"]
        ]

        self.assertEqual(
            names,
            [
                "White Sand",
                "Eco Friendly",
            ],
        )

    def test_create_specialty_tag(self):
        response = self.client.post(
            "/api/admin/msmes/specialty-tags/",
            {
                "TAG_NAME": "Heritage Site",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["TAG_NAME"],
            "Heritage Site",
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_NAME="Heritage Site",
            ).exists()
        )

    def test_create_specialty_tag_strips_name(self):
        response = self.client.post(
            "/api/admin/msmes/specialty-tags/",
            {
                "TAG_NAME": "  Nature Retreat  ",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["TAG_NAME"],
            "Nature Retreat",
        )

    def test_get_specialty_tag(self):
        response = self.client.get(
            f"/api/admin/msmes/specialty-tags/{self.tag.TAG_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["TAG_ID"],
            self.tag.TAG_ID,
        )

        self.assertEqual(
            response.data["data"]["TAG_NAME"],
            "Eco Friendly",
        )

    def test_put_specialty_tag(self):
        response = self.client.put(
            f"/api/admin/msmes/specialty-tags/{self.tag.TAG_ID}/",
            {
                "TAG_NAME": "Sustainable Tourism",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Sustainable Tourism",
        )

        self.assertEqual(
            response.data["data"]["TAG_NAME"],
            "Sustainable Tourism",
        )

    def test_patch_specialty_tag(self):
        response = self.client.patch(
            f"/api/admin/msmes/specialty-tags/{self.tag.TAG_ID}/",
            {
                "TAG_NAME": "Eco Tourism",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Eco Tourism",
        )

        self.assertEqual(
            response.data["data"]["TAG_NAME"],
            "Eco Tourism",
        )

    def test_delete_specialty_tag(self):
        tag_id = self.tag.TAG_ID

        response = self.client.delete(
            f"/api/admin/msmes/specialty-tags/{tag_id}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            SpecialtyTag.objects.filter(
                TAG_ID=tag_id,
            ).exists()
        )

    def test_get_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.get(
            "/api/admin/msmes/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.patch(
            "/api/admin/msmes/specialty-tags/9999/",
            {
                "TAG_NAME": "Beachfront",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.delete(
            "/api/admin/msmes/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )