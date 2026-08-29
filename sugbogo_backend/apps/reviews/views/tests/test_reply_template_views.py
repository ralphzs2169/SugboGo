from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.constants import MAX_REPLY_TEMPLATES
from apps.reviews.models import ReplyTemplate
from apps.users.models import User


class ReplyTemplateViewTests(APITestCase):
    """Tests for merchant saved reply template API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-template@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_merchant = User.objects.create_user(
            email="merchant-template-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-template@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(
            self.merchant,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.url = "/api/reviews/reply-templates/"

    def create_template(self):
        return ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Thank you",
            RTPL_TEXT="Thank you for taking the time to leave us a review!",
        )

    def test_get_templates_successfully(self):
        template = self.create_template()

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Reply templates retrieved successfully.",
        )

        self.assertEqual(
            len(response.data["data"]),
            1,
        )

        self.assertEqual(
            response.data["data"][0]["id"],
            template.RTPL_ID,
        )

        self.assertEqual(
            response.data["data"][0]["title"],
            template.RTPL_TITLE,
        )

        self.assertEqual(
            response.data["data"][0]["text"],
            template.RTPL_TEXT,
        )

    def test_get_templates_only_returns_merchant_templates(self):
        self.create_template()

        ReplyTemplate.objects.create(
            BUSN_ID=Business.objects.create(
                BUSN_NAME="Second Bistro",
                BUSN_DESCRIPTION="Another restaurant.",
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                USER_ID=self.second_merchant,
                CTGRY_ID=self.category,
                LOCT_ID=self.location,
            ),
            RTPL_TITLE="Other business",
            RTPL_TEXT="This belongs to another business.",
        )

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["data"]),
            1,
        )

        self.assertEqual(
            response.data["data"][0]["title"],
            "Thank you",
        )

    def test_create_template_successfully(self):
        payload = {
            "title": "Thank you",
            "text": "Thank you for your wonderful review!",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        template = ReplyTemplate.objects.get(
            RTPL_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            template.BUSN_ID_id,
            self.business.BUSN_ID,
        )

        self.assertEqual(
            template.RTPL_TITLE,
            "Thank you",
        )

        self.assertEqual(
            template.RTPL_TEXT,
            "Thank you for your wonderful review!",
        )

        self.assertEqual(
            response.data["message"],
            "Reply template created successfully.",
        )

    def test_create_template_rejects_missing_title(self):
        response = self.client.post(
            self.url,
            {
                "text": "Thank you for your review!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "title",
            response.data["errors"],
        )

    def test_create_template_rejects_missing_text(self):
        response = self.client.post(
            self.url,
            {
                "title": "Thank you",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

    def test_create_template_rejects_title_over_max_length(self):
        response = self.client.post(
            self.url,
            {
                "title": "x" * 101,
                "text": "Thank you for your review!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "title",
            response.data["errors"],
        )

    def test_create_template_rejects_text_over_max_length(self):
        response = self.client.post(
            self.url,
            {
                "title": "Thank you",
                "text": "x" * 1001,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

    def test_create_template_rejects_above_maximum(self):
        ReplyTemplate.objects.bulk_create(
            [
                ReplyTemplate(
                    BUSN_ID=self.business,
                    RTPL_TITLE=f"Template {index}",
                    RTPL_TEXT=f"Reply {index}",
                )
                for index in range(MAX_REPLY_TEMPLATES)
            ],
        )

        response = self.client.post(
            self.url,
            {
                "title": "One too many",
                "text": "This should not be created.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertEqual(
            response.data["message"],
            (
                f"You can only save up to {MAX_REPLY_TEMPLATES} "
                "reply templates."
            ),
        )

        self.assertEqual(
            ReplyTemplate.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            MAX_REPLY_TEMPLATES,
        )

    def test_update_template_successfully(self):
        template = self.create_template()

        response = self.client.patch(
            f"{self.url}{template.RTPL_ID}/",
            {
                "title": "Updated title",
                "text": "Updated reply text.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Updated title",
        )

        self.assertEqual(
            template.RTPL_TEXT,
            "Updated reply text.",
        )

        self.assertEqual(
            response.data["message"],
            "Reply template updated successfully.",
        )

    def test_update_template_title_only(self):
        template = self.create_template()

        response = self.client.patch(
            f"{self.url}{template.RTPL_ID}/",
            {
                "title": "Updated title",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Updated title",
        )

        self.assertEqual(
            template.RTPL_TEXT,
            "Thank you for taking the time to leave us a review!",
        )

    def test_update_template_text_only(self):
        template = self.create_template()

        response = self.client.patch(
            f"{self.url}{template.RTPL_ID}/",
            {
                "text": "Updated reply text.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Thank you",
        )

        self.assertEqual(
            template.RTPL_TEXT,
            "Updated reply text.",
        )

    def test_update_template_rejects_empty_payload(self):
        template = self.create_template()

        response = self.client.patch(
            f"{self.url}{template.RTPL_ID}/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "non_field_errors",
            response.data["errors"],
        )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Thank you",
        )

    def test_update_template_rejects_nonexistent_template(self):
        response = self.client.patch(
            f"{self.url}999999/",
            {
                "title": "Updated title",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The reply template could not be found.",
        )

    def test_update_template_rejects_another_business_template(self):
        second_business = Business.objects.create(
            BUSN_NAME="Second Bistro",
            BUSN_DESCRIPTION="Another restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        template = ReplyTemplate.objects.create(
            BUSN_ID=second_business,
            RTPL_TITLE="Protected template",
            RTPL_TEXT="Protected text.",
        )

        response = self.client.patch(
            f"{self.url}{template.RTPL_ID}/",
            {
                "title": "Unauthorized update",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Protected template",
        )

    def test_delete_template_successfully(self):
        template = self.create_template()

        response = self.client.delete(
            f"{self.url}{template.RTPL_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Reply template deleted successfully.",
        )

        self.assertFalse(
            ReplyTemplate.objects.filter(
                RTPL_ID=template.RTPL_ID,
            ).exists(),
        )

        self.assertEqual(
            response.data["data"],
            {
                "template_id": template.RTPL_ID,
            },
        )

    def test_delete_template_rejects_nonexistent_template(self):
        response = self.client.delete(
            f"{self.url}999999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The reply template could not be found.",
        )

    def test_delete_template_rejects_another_business_template(self):
        second_business = Business.objects.create(
            BUSN_NAME="Second Bistro",
            BUSN_DESCRIPTION="Another restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        template = ReplyTemplate.objects.create(
            BUSN_ID=second_business,
            RTPL_TITLE="Protected template",
            RTPL_TEXT="Protected text.",
        )

        response = self.client.delete(
            f"{self.url}{template.RTPL_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertTrue(
            ReplyTemplate.objects.filter(
                RTPL_ID=template.RTPL_ID,
            ).exists(),
        )

    def test_explorer_cannot_access_reply_templates(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertEqual(
            response.data["message"],
            "You do not have permission to perform this action.",
        )

    def test_unauthenticated_user_cannot_access_reply_templates(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )