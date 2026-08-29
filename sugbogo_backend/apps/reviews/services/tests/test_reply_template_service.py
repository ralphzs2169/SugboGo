from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.constants import MAX_REPLY_TEMPLATES
from apps.reviews.models import ReplyTemplate
from apps.reviews.services.reply_template_service import ReplyTemplateService
from apps.users.models import User


class ReplyTemplateServiceTests(TestCase):
    """Tests for managing merchant saved reply templates."""

    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.second_merchant = User.objects.create_user(
            email="merchant2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cls.cluster,
        )

        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.8900,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Colon Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

        cls.second_business = Business.objects.create(
            BUSN_NAME="Second Bistro",
            BUSN_DESCRIPTION="Another Cebu-based restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.second_merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.second_location,
        )

    def test_get_templates_returns_merchant_templates(self):
        first_template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Thank you",
            RTPL_TEXT="Thank you for your wonderful review!",
        )

        second_template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Apology",
            RTPL_TEXT="We are sorry to hear about your experience.",
        )

        ReplyTemplate.objects.create(
            BUSN_ID=self.second_business,
            RTPL_TITLE="Other business",
            RTPL_TEXT="This belongs to another business.",
        )

        templates = ReplyTemplateService.get_templates(
            user=self.merchant,
        )

        self.assertEqual(
            templates.count(),
            2,
        )

        template_ids = {
            template.RTPL_ID
            for template in templates
        }

        self.assertIn(
            first_template.RTPL_ID,
            template_ids,
        )

        self.assertIn(
            second_template.RTPL_ID,
            template_ids,
        )

    def test_get_templates_returns_empty_queryset_when_no_templates_exist(self):
        templates = ReplyTemplateService.get_templates(
            user=self.merchant,
        )

        self.assertEqual(
            templates.count(),
            0,
        )

    def test_get_templates_rejects_merchant_without_business(self):
        merchant_without_business = User.objects.create_user(
            email="merchant3@example.com",
            password="StrongPassword123!",
            USER_FNAME="No",
            USER_LNAME="Business",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        with self.assertRaisesMessage(
            NotFound,
            "Your business could not be found.",
        ):
            ReplyTemplateService.get_templates(
                user=merchant_without_business,
            )

    def test_create_template(self):
        template = ReplyTemplateService.create_template(
            user=self.merchant,
            title="Thank you",
            text="Thank you for taking the time to leave us a review!",
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
            "Thank you for taking the time to leave us a review!",
        )

        self.assertTrue(
            ReplyTemplate.objects.filter(
                RTPL_ID=template.RTPL_ID,
            ).exists(),
        )

    def test_create_template_rejects_merchant_without_business(self):
        merchant_without_business = User.objects.create_user(
            email="merchant4@example.com",
            password="StrongPassword123!",
            USER_FNAME="No",
            USER_LNAME="Business",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        with self.assertRaisesMessage(
            NotFound,
            "Your business could not be found.",
        ):
            ReplyTemplateService.create_template(
                user=merchant_without_business,
                title="Thank you",
                text="Thank you for your review!",
            )

        self.assertFalse(
            ReplyTemplate.objects.filter(
                RTPL_TITLE="Thank you",
            ).exists(),
        )

    def test_create_template_allows_exactly_maximum_templates(self):
        for index in range(MAX_REPLY_TEMPLATES):
            ReplyTemplateService.create_template(
                user=self.merchant,
                title=f"Template {index + 1}",
                text=f"Reply text {index + 1}",
            )

        self.assertEqual(
            ReplyTemplate.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            MAX_REPLY_TEMPLATES,
        )

    def test_create_template_rejects_template_above_maximum(self):
        ReplyTemplate.objects.bulk_create(
            [
                ReplyTemplate(
                    BUSN_ID=self.business,
                    RTPL_TITLE=f"Template {index + 1}",
                    RTPL_TEXT=f"Reply text {index + 1}",
                )
                for index in range(MAX_REPLY_TEMPLATES)
            ],
        )

        with self.assertRaisesMessage(
            ValidationError,
            (
                f"You can only save up to {MAX_REPLY_TEMPLATES} "
                "reply templates."
            ),
        ):
            ReplyTemplateService.create_template(
                user=self.merchant,
                title="One too many",
                text="This template should not be created.",
            )

        self.assertEqual(
            ReplyTemplate.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            MAX_REPLY_TEMPLATES,
        )

    def test_template_limit_is_per_business(self):
        ReplyTemplate.objects.bulk_create(
            [
                ReplyTemplate(
                    BUSN_ID=self.business,
                    RTPL_TITLE=f"Template {index + 1}",
                    RTPL_TEXT=f"Reply text {index + 1}",
                )
                for index in range(MAX_REPLY_TEMPLATES)
            ],
        )

        template = ReplyTemplateService.create_template(
            user=self.second_merchant,
            title="Second business template",
            text="This business still has room.",
        )

        self.assertEqual(
            template.BUSN_ID_id,
            self.second_business.BUSN_ID,
        )

        self.assertEqual(
            ReplyTemplate.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            MAX_REPLY_TEMPLATES,
        )

        self.assertEqual(
            ReplyTemplate.objects.filter(
                BUSN_ID=self.second_business,
            ).count(),
            1,
        )

    def test_update_template_title(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Original title",
            RTPL_TEXT="Original text",
        )

        updated_template = ReplyTemplateService.update_template(
            user=self.merchant,
            template_id=template.RTPL_ID,
            title="Updated title",
        )

        self.assertEqual(
            updated_template.RTPL_TITLE,
            "Updated title",
        )

        self.assertEqual(
            updated_template.RTPL_TEXT,
            "Original text",
        )

    def test_update_template_text(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Original title",
            RTPL_TEXT="Original text",
        )

        updated_template = ReplyTemplateService.update_template(
            user=self.merchant,
            template_id=template.RTPL_ID,
            text="Updated text",
        )

        self.assertEqual(
            updated_template.RTPL_TITLE,
            "Original title",
        )

        self.assertEqual(
            updated_template.RTPL_TEXT,
            "Updated text",
        )

    def test_update_template_title_and_text(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Original title",
            RTPL_TEXT="Original text",
        )

        updated_template = ReplyTemplateService.update_template(
            user=self.merchant,
            template_id=template.RTPL_ID,
            title="Updated title",
            text="Updated text",
        )

        self.assertEqual(
            updated_template.RTPL_TITLE,
            "Updated title",
        )

        self.assertEqual(
            updated_template.RTPL_TEXT,
            "Updated text",
        )

    def test_update_template_rejects_empty_update(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Original title",
            RTPL_TEXT="Original text",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Provide a title or text to update.",
        ):
            ReplyTemplateService.update_template(
                user=self.merchant,
                template_id=template.RTPL_ID,
            )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Original title",
        )

        self.assertEqual(
            template.RTPL_TEXT,
            "Original text",
        )

    def test_update_template_rejects_nonexistent_template(self):
        with self.assertRaisesMessage(
            NotFound,
            "The reply template could not be found.",
        ):
            ReplyTemplateService.update_template(
                user=self.merchant,
                template_id=999999,
                title="Updated title",
            )

    def test_update_template_rejects_template_from_another_business(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.second_business,
            RTPL_TITLE="Other business",
            RTPL_TEXT="Other business text",
        )

        with self.assertRaisesMessage(
            NotFound,
            "The reply template could not be found.",
        ):
            ReplyTemplateService.update_template(
                user=self.merchant,
                template_id=template.RTPL_ID,
                title="Unauthorized update",
            )

        template.refresh_from_db()

        self.assertEqual(
            template.RTPL_TITLE,
            "Other business",
        )

    def test_delete_template(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.business,
            RTPL_TITLE="Delete me",
            RTPL_TEXT="This template will be deleted.",
        )

        ReplyTemplateService.delete_template(
            user=self.merchant,
            template_id=template.RTPL_ID,
        )

        self.assertFalse(
            ReplyTemplate.objects.filter(
                RTPL_ID=template.RTPL_ID,
            ).exists(),
        )

    def test_delete_template_rejects_nonexistent_template(self):
        with self.assertRaisesMessage(
            NotFound,
            "The reply template could not be found.",
        ):
            ReplyTemplateService.delete_template(
                user=self.merchant,
                template_id=999999,
            )

    def test_delete_template_rejects_template_from_another_business(self):
        template = ReplyTemplate.objects.create(
            BUSN_ID=self.second_business,
            RTPL_TITLE="Protected template",
            RTPL_TEXT="This belongs to another business.",
        )

        with self.assertRaisesMessage(
            NotFound,
            "The reply template could not be found.",
        ):
            ReplyTemplateService.delete_template(
                user=self.merchant,
                template_id=template.RTPL_ID,
            )

        self.assertTrue(
            ReplyTemplate.objects.filter(
                RTPL_ID=template.RTPL_ID,
            ).exists(),
        )