from decimal import Decimal
from importlib import import_module
from unittest.mock import patch

from django.apps import apps as django_apps
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.business_specialty_service import (
    BusinessSpecialtyService,
)
from apps.business.services.vouch_service import VouchService
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent, User


class SpecialtyEvidenceContextTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.explorer = User.objects.create_user(
            email="direct-evidence-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Direct",
            USER_LNAME="Evidence",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.business_owner = User.objects.create_user(
            email="direct-evidence-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CTGRY_DESCRIPTION="Coffee and pastries.",
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

        cls.business = Business.objects.create(
            BUSN_NAME="Direct Evidence Cafe",
            BUSN_DESCRIPTION="A neighborhood cafe.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.business_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

        cls.specialty = SpecialtyTag.objects.create(
            TAG_NAME="Best Coffee",
            TAG_COLOR="red",
        )

        cls.business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.specialty,
        )

    def _create_vouch(self):
        return VouchService.create_vouch(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            tag_id=self.specialty.TAG_ID,
            device_id="direct-evidence-device",
        )

    def _create_review(self):
        return ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="The experience was detailed and worthwhile.",
        )

    @staticmethod
    def _evidence_state(vouch):
        vouch.refresh_from_db()

        return (
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            vouch.VOUCH_EVIDENCE_IS_VALID,
            vouch.VOUCH_EVIDENCE_INVALIDATED_AT,
            vouch.VOUCH_FLAG_SUSPICIOUS,
            vouch.VOUCH_CREATED_AT,
            vouch.VOUCH_UPDATED_AT,
        )

    def test_new_vouch_captures_decimal_reputation_once(self):
        User.objects.filter(
            USER_ID=self.explorer.USER_ID,
        ).update(
            USER_REPUTATION=Decimal("0.30"),
        )
        self.explorer.refresh_from_db()

        vouch = self._create_vouch()

        User.objects.filter(
            USER_ID=self.explorer.USER_ID,
        ).update(
            USER_REPUTATION=Decimal("0.80"),
        )
        vouch.refresh_from_db()

        self.assertIsInstance(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.30"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )
        self.assertIsNone(
            vouch.VOUCH_EVIDENCE_INVALIDATED_AT,
        )
        self.assertFalse(
            ReputationEvent.objects.exists(),
        )

    def test_suspicious_vouch_is_not_automatically_invalid(self):
        vouch = self._create_vouch()

        vouch.VOUCH_FLAG_SUSPICIOUS = True
        vouch.save(
            update_fields=[
                "VOUCH_FLAG_SUSPICIOUS",
                "VOUCH_UPDATED_AT",
            ],
        )
        vouch.refresh_from_db()

        self.assertTrue(
            vouch.VOUCH_FLAG_SUSPICIOUS,
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )
        self.assertIsNone(
            vouch.VOUCH_EVIDENCE_INVALIDATED_AT,
        )

    def test_review_creation_does_not_alter_existing_vouch(self):
        vouch = self._create_vouch()
        original_state = self._evidence_state(
            vouch,
        )

        self._create_review()

        self.assertEqual(
            self._evidence_state(vouch),
            original_state,
        )

    def test_existing_review_does_not_change_new_vouch_behavior(self):
        self._create_review()

        User.objects.filter(
            USER_ID=self.explorer.USER_ID,
        ).update(
            USER_REPUTATION=Decimal("0.42"),
        )
        self.explorer.refresh_from_db()

        vouch = self._create_vouch()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.42"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )

    def test_existing_review_photo_does_not_change_new_vouch_behavior(self):
        review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="The experience was detailed and worthwhile.",
        )
        ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL="https://example.com/existing-photo.jpg",
            RPHO_PHOTO_PUBLIC_ID="sugbogo/reviews/existing-photo",
        )

        vouch = self._create_vouch()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            self.explorer.USER_REPUTATION,
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )

    def test_review_text_edit_does_not_alter_existing_vouch(self):
        vouch = self._create_vouch()
        review = self._create_review()
        original_state = self._evidence_state(
            vouch,
        )

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            text="The edited review remains detailed and worthwhile.",
        )

        self.assertEqual(
            self._evidence_state(vouch),
            original_state,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_adding_review_photo_does_not_alter_existing_vouch(
        self,
        mock_upload,
    ):
        vouch = self._create_vouch()
        review = self._create_review()
        original_state = self._evidence_state(
            vouch,
        )

        mock_upload.return_value = {
            "secure_url": "https://example.com/new-photo.jpg",
            "public_id": "sugbogo/reviews/new-photo",
        }

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            photos=[
                object(),
            ],
        )

        self.assertEqual(
            self._evidence_state(vouch),
            original_state,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    def test_removing_review_photo_does_not_alter_existing_vouch(
        self,
        mock_delete,
    ):
        vouch = self._create_vouch()
        review = self._create_review()
        photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL="https://example.com/removable-photo.jpg",
            RPHO_PHOTO_PUBLIC_ID="sugbogo/reviews/removable-photo",
        )
        original_state = self._evidence_state(
            vouch,
        )

        ReviewService.delete_photo(
            user=self.explorer,
            photo_id=photo.RPHO_ID,
        )

        self.assertEqual(
            self._evidence_state(vouch),
            original_state,
        )
        mock_delete.assert_called_once_with(
            photo.RPHO_PHOTO_PUBLIC_ID,
        )

    def test_review_deletion_does_not_delete_or_alter_vouch(self):
        vouch = self._create_vouch()
        review = self._create_review()
        original_state = self._evidence_state(
            vouch,
        )

        ReviewService.delete_review(
            user=self.explorer,
            review_id=review.REVW_ID,
        )

        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )
        self.assertEqual(
            self._evidence_state(vouch),
            original_state,
        )

    def test_specialty_lifecycle_preserves_vouch_snapshot(self):
        User.objects.filter(
            USER_ID=self.explorer.USER_ID,
        ).update(
            USER_REPUTATION=Decimal("0.36"),
        )
        self.explorer.refresh_from_db()

        vouch = self._create_vouch()

        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.specialty.TAG_ID,
        )

        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )

        BusinessSpecialtyService.reactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.specialty.TAG_ID,
        )

        vouch.refresh_from_db()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.36"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )

    def test_legacy_migration_uses_conservative_evidence_defaults(self):
        vouch = self._create_vouch()
        Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="The experience was detailed and worthwhile.",
        )

        BusinessVouch.objects.filter(
            VOUCH_ID=vouch.VOUCH_ID,
        ).update(
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.75"),
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_EVIDENCE_INVALIDATED_AT=timezone.now(),
        )

        migration = import_module(
            "apps.business.migrations."
            "0023_businessvouch_evidence_context",
        )
        migration.initialize_legacy_vouch_evidence(
            django_apps,
            None,
        )

        vouch.refresh_from_db()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.20"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )
        self.assertIsNone(
            vouch.VOUCH_EVIDENCE_INVALIDATED_AT,
        )
        self.assertNotIn(
            "REVW_ID",
            {
                field.name
                for field in BusinessVouch._meta.fields
            },
        )
