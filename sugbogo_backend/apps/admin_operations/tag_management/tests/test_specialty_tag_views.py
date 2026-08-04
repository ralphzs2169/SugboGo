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
            TAG_COLOR=SpecialtyTag.TagColor.GREEN,
        )

        self.other_tag = SpecialtyTag.objects.create(
            TAG_NAME="White Sand",
            TAG_COLOR=SpecialtyTag.TagColor.BLUE,
        )

    def test_list_specialty_tags_returns_tags(self):
        response = self.client.get(
            "/api/admin/specialty-tags/",
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

        tag = response.data["data"]["items"][0]

        self.assertIn("id", tag)
        self.assertIn("name", tag)
        self.assertIn("color", tag)
        self.assertIn("created_at", tag)
        self.assertIn("updated_at", tag)

    def test_list_specialty_tags_filters_by_search(self):
        response = self.client.get(
            "/api/admin/specialty-tags/?search=eco",
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
            response.data["data"]["items"][0]["name"],
            "Eco Friendly",
        )

        self.assertEqual(
            response.data["data"]["items"][0]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_list_specialty_tags_orders_by_name_descending(self):
        response = self.client.get(
            "/api/admin/specialty-tags/?ordering=-name",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = [
            item["name"]
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
            "/api/admin/specialty-tags/",
            {
                "name": "Heritage Site",
                "color": SpecialtyTag.TagColor.BLUE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Heritage Site",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_NAME="Heritage Site",
                TAG_COLOR=SpecialtyTag.TagColor.BLUE,
            ).exists()
        )

    def test_create_specialty_tag_defaults_to_blue(self):
        response = self.client.post(
            "/api/admin/specialty-tags/",
            {
                "name": "Heritage Site",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Heritage Site",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_NAME="Heritage Site",
                TAG_COLOR=SpecialtyTag.TagColor.BLUE,
            ).exists()
        )

    def test_create_specialty_tag_strips_name(self):
        response = self.client.post(
            "/api/admin/specialty-tags/",
            {
                "name": "  Nature Retreat  ",
                "color": SpecialtyTag.TagColor.GREEN,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Nature Retreat",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_get_specialty_tag(self):
        response = self.client.get(
            f"/api/admin/specialty-tags/{self.tag.TAG_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"]["id"],
            self.tag.TAG_ID,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Eco Friendly",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.GREEN,
        )

    def test_put_specialty_tag(self):
        response = self.client.put(
            f"/api/admin/specialty-tags/{self.tag.TAG_ID}/",
            {
                "name": "Sustainable Tourism",
                "color": SpecialtyTag.TagColor.BLUE,
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
            self.tag.TAG_COLOR,
            SpecialtyTag.TagColor.BLUE,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Sustainable Tourism",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.BLUE,
        )

    def test_patch_specialty_tag(self):
        response = self.client.patch(
            f"/api/admin/specialty-tags/{self.tag.TAG_ID}/",
            {
                "name": "Eco Tourism",
                "color": SpecialtyTag.TagColor.PURPLE,
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
            self.tag.TAG_COLOR,
            SpecialtyTag.TagColor.PURPLE,
        )

        self.assertEqual(
            response.data["data"]["name"],
            "Eco Tourism",
        )

        self.assertEqual(
            response.data["data"]["color"],
            SpecialtyTag.TagColor.PURPLE,
        )

    def test_delete_specialty_tag(self):
        tag_id = self.tag.TAG_ID

        response = self.client.delete(
            f"/api/admin/specialty-tags/{tag_id}/",
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
            "/api/admin/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.patch(
            "/api/admin/specialty-tags/9999/",
            {
                "name": "Beachfront",
                "color": SpecialtyTag.TagColor.BLUE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_specialty_tag_returns_404_for_missing_tag(self):
        response = self.client.delete(
            "/api/admin/specialty-tags/9999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )