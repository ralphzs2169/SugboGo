from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.vouch_service import VouchService
from apps.reviews.models import ReviewPhoto
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent, User
from apps.users.services.reputation_service import ReputationService


class ReputationInteractionIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.explorer = User.objects.create_user(
            email="reputation-interaction@example.com",
            password="StrongPassword123!",
            USER_FNAME="Reputation",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.business_owner = User.objects.create_user(
            email="reputation-business-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.second_business_owner = User.objects.create_user(
            email="second-reputation-business-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
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
            CTGRY_DESCRIPTION="Coffee shops.",
            CLUS_ID=cls.cluster,
        )

        cls.first_location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="First Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.8864,
                10.3167,
                srid=4326,
            ),
            LOCT_ADDRESS="Second Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.first_business = Business.objects.create(
            BUSN_NAME="First Cafe",
            BUSN_DESCRIPTION="A neighborhood cafe.",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=cls.second_business_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.first_location,
        )

        cls.second_business = Business.objects.create(
            BUSN_NAME="Second Cafe",
            BUSN_DESCRIPTION="Another neighborhood cafe.",
            BUSN_CONTACT_NUMBER="09179876543",
            USER_ID=cls.business_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.second_location,
        )

        cls.coffee_tag = SpecialtyTag.objects.create(
            TAG_NAME="Best Coffee",
            TAG_COLOR="red",
        )

        cls.cozy_tag = SpecialtyTag.objects.create(
            TAG_NAME="Cozy Atmosphere",
            TAG_COLOR="blue",
        )

        cls.coffee_assignment = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.first_business,
            TAG_ID=cls.coffee_tag,
        )

        cls.cozy_assignment = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.first_business,
            TAG_ID=cls.cozy_tag,
        )

    def _set_reputation(
        self,
        reputation: str,
    ):
        User.objects.filter(
            USER_ID=self.explorer.USER_ID,
        ).update(
            USER_REPUTATION=Decimal(reputation),
        )
        self.explorer.refresh_from_db()

    def _create_vouch(
        self,
        tag=None,
    ):
        selected_tag = tag or self.coffee_tag

        return VouchService.create_vouch(
            user=self.explorer,
            business_id=self.first_business.BUSN_ID,
            tag_id=selected_tag.TAG_ID,
        )

    def _create_review(
        self,
        business=None,
        photos=None,
    ):
        selected_business = business or self.first_business

        return ReviewService.create_review(
            user=self.explorer,
            business_id=selected_business.BUSN_ID,
            text="The experience was detailed and worthwhile.",
            photos=photos,
        )

    def test_vouch_snapshots_before_applying_reward(self):
        vouch = self._create_vouch()

        self.explorer.refresh_from_db()
        event = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=ReputationEvent.EventType.VOUCH_REWARD,
        )

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.20"),
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.21"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.01"),
        )
        self.assertEqual(
            event.REVT_RESULTING_REPUTATION,
            Decimal("0.21"),
        )
        self.assertEqual(
            event.REVT_SOURCE_ID,
            vouch.VOUCH_ID,
        )

    def test_vouch_reward_obeys_cap_without_lowering_reputation(self):
        self._set_reputation(
            "0.39",
        )

        self._create_vouch()
        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.40"),
        )

        VouchService.remove_vouch(
            user=self.explorer,
            business_id=self.first_business.BUSN_ID,
            tag_id=self.coffee_tag.TAG_ID,
        )

        self._set_reputation(
            "0.65",
        )

        self._create_vouch()
        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.65"),
        )

    def test_different_specialty_vouches_each_receive_reward(self):
        self._create_vouch(
            tag=self.coffee_tag,
        )
        self._create_vouch(
            tag=self.cozy_tag,
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.22"),
        )
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=(
                    ReputationEvent.EventType.VOUCH_REWARD
                ),
            ).count(),
            2,
        )

    def test_recreated_vouch_does_not_receive_reward_again(self):
        first_vouch = self._create_vouch()

        VouchService.remove_vouch(
            user=self.explorer,
            business_id=self.first_business.BUSN_ID,
            tag_id=self.coffee_tag.TAG_ID,
        )

        recreated_vouch = self._create_vouch()
        self.explorer.refresh_from_db()

        self.assertNotEqual(
            recreated_vouch.VOUCH_ID,
            first_vouch.VOUCH_ID,
        )
        self.assertEqual(
            recreated_vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.21"),
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.21"),
        )
        self.assertEqual(
            ReputationEvent.objects.filter(
                REVT_EVENT_TYPE=(
                    ReputationEvent.EventType.VOUCH_REWARD
                ),
            ).count(),
            1,
        )

    def test_duplicate_logical_vouch_reward_is_database_idempotent(self):
        vouch = self._create_vouch()

        duplicate = ReputationService.apply_vouch_reward(
            user_id=self.explorer.USER_ID,
            source_id=vouch.VOUCH_ID + 1000,
            business_id=self.first_business.BUSN_ID,
            specialty_tag_id=self.coffee_tag.TAG_ID,
        )
        original = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=ReputationEvent.EventType.VOUCH_REWARD,
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            duplicate.REVT_ID,
            original.REVT_ID,
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.21"),
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ReputationEvent.objects.create(
                    USER_ID=self.explorer,
                    REVT_EVENT_TYPE=original.REVT_EVENT_TYPE,
                    REVT_APPLIED_CHANGE=Decimal("0.01"),
                    REVT_RESULTING_REPUTATION=Decimal("0.22"),
                    REVT_SOURCE_TYPE=original.REVT_SOURCE_TYPE,
                    REVT_SOURCE_ID=vouch.VOUCH_ID + 2000,
                    REVT_SOURCE_KEY=original.REVT_SOURCE_KEY,
                )

    @patch(
        "apps.business.services.vouch_service."
        "ReputationService.apply_vouch_reward",
        side_effect=RuntimeError("Reputation update failed."),
    )
    def test_vouch_and_counters_roll_back_when_reward_fails(
        self,
        mock_reward,
    ):
        with self.assertRaises(RuntimeError):
            self._create_vouch()

        self.first_business.refresh_from_db()
        self.coffee_assignment.refresh_from_db()

        self.assertFalse(
            BusinessVouch.objects.exists(),
        )
        self.assertEqual(
            self.first_business.BUSN_VOUCH_COUNT,
            0,
        )
        self.assertEqual(
            self.coffee_assignment.BST_VOUCH_COUNT,
            0,
        )
        mock_reward.assert_called_once()

    def test_review_without_photo_receives_base_reward(self):
        review = self._create_review()

        self.explorer.refresh_from_db()
        event = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=ReputationEvent.EventType.REVIEW_REWARD,
        )

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.23"),
        )
        self.assertEqual(
            event.REVT_APPLIED_CHANGE,
            Decimal("0.03"),
        )
        self.assertEqual(
            event.REVT_RESULTING_REPUTATION,
            Decimal("0.23"),
        )
        self.assertEqual(
            event.REVT_SOURCE_ID,
            review.REVW_ID,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_review_created_with_photo_receives_exact_photo_tier(
        self,
        mock_upload,
    ):
        mock_upload.return_value = {
            "secure_url": "https://example.com/initial-photo.jpg",
            "public_id": "sugbogo/reviews/initial-photo",
        }

        self._create_review(
            photos=[
                object(),
            ],
        )

        self.explorer.refresh_from_db()
        events = ReputationEvent.objects.all()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            events.count(),
            1,
        )
        self.assertEqual(
            events.get().REVT_EVENT_TYPE,
            ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD,
        )
        self.assertEqual(
            events.get().REVT_APPLIED_CHANGE,
            Decimal("0.05"),
        )

    @patch(
        "apps.reviews.services.review_service."
        "ReputationService.apply_review_with_photo_reward",
        side_effect=RuntimeError("Reputation update failed."),
    )
    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_review_and_photo_roll_back_when_reward_fails(
        self,
        mock_upload,
        mock_delete,
        mock_reward,
    ):
        mock_upload.return_value = {
            "secure_url": "https://example.com/rollback-photo.jpg",
            "public_id": "sugbogo/reviews/rollback-photo",
        }

        with self.assertRaises(RuntimeError):
            self._create_review(
                photos=[
                    object(),
                ],
            )

        self.first_business.refresh_from_db()

        self.assertFalse(
            self.first_business.reviews.exists(),
        )
        self.assertFalse(
            ReviewPhoto.objects.exists(),
        )
        self.assertEqual(
            self.first_business.BUSN_REVIEW_COUNT,
            0,
        )
        mock_delete.assert_called_once_with(
            "sugbogo/reviews/rollback-photo",
        )
        mock_reward.assert_called_once()

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_first_photo_added_later_applies_only_configured_difference(
        self,
        mock_upload,
    ):
        review = self._create_review()

        mock_upload.return_value = {
            "secure_url": "https://example.com/later-photo.jpg",
            "public_id": "sugbogo/reviews/later-photo",
        }

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            photos=[
                object(),
            ],
        )

        self.explorer.refresh_from_db()
        photo_event = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=(
                ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD
            ),
        )

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            photo_event.REVT_APPLIED_CHANGE,
            Decimal("0.02"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_additional_photos_do_not_receive_more_reputation(
        self,
        mock_upload,
    ):
        review = self._create_review()
        mock_upload.side_effect = [
            {
                "secure_url": "https://example.com/first-photo.jpg",
                "public_id": "sugbogo/reviews/first-photo",
            },
            {
                "secure_url": "https://example.com/second-photo.jpg",
                "public_id": "sugbogo/reviews/second-photo",
            },
        ]

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            photos=[
                object(),
            ],
        )
        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            photos=[
                object(),
            ],
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.delete_image",
    )
    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_photo_removal_and_text_edits_do_not_change_reputation(
        self,
        mock_upload,
        mock_delete,
    ):
        mock_upload.return_value = {
            "secure_url": "https://example.com/review-photo.jpg",
            "public_id": "sugbogo/reviews/review-photo",
        }
        review = self._create_review(
            photos=[
                object(),
            ],
        )
        photo = ReviewPhoto.objects.get(
            REVW_ID=review,
        )

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            text="The edited review remains detailed and worthwhile.",
        )
        ReviewService.delete_photo(
            user=self.explorer,
            photo_id=photo.RPHO_ID,
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            1,
        )

    def test_review_delete_and_recreate_does_not_repeat_base_reward(self):
        first_review = self._create_review()

        ReviewService.delete_review(
            user=self.explorer,
            review_id=first_review.REVW_ID,
        )

        recreated_review = self._create_review()
        self.explorer.refresh_from_db()

        self.assertNotEqual(
            recreated_review.REVW_ID,
            first_review.REVW_ID,
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.23"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            1,
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_recreated_review_can_receive_only_missing_photo_difference(
        self,
        mock_upload,
    ):
        first_review = self._create_review()

        ReviewService.delete_review(
            user=self.explorer,
            review_id=first_review.REVW_ID,
        )

        mock_upload.return_value = {
            "secure_url": "https://example.com/recreated-photo.jpg",
            "public_id": "sugbogo/reviews/recreated-photo",
        }

        self._create_review(
            photos=[
                object(),
            ],
        )
        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.25"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )
        self.assertEqual(
            ReputationEvent.objects.get(
                REVT_EVENT_TYPE=(
                    ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD
                ),
            ).REVT_APPLIED_CHANGE,
            Decimal("0.02"),
        )

    def test_reviews_for_different_businesses_reward_independently(self):
        self._create_review(
            business=self.first_business,
        )
        self._create_review(
            business=self.second_business,
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.26"),
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            2,
        )

    def test_duplicate_logical_review_reward_is_idempotent(self):
        review = self._create_review()

        duplicate = ReputationService.apply_review_reward(
            user_id=self.explorer.USER_ID,
            source_id=review.REVW_ID + 1000,
            business_id=self.first_business.BUSN_ID,
        )
        original = ReputationEvent.objects.get(
            REVT_EVENT_TYPE=ReputationEvent.EventType.REVIEW_REWARD,
        )

        self.explorer.refresh_from_db()

        self.assertEqual(
            duplicate.REVT_ID,
            original.REVT_ID,
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            Decimal("0.23"),
        )

    @patch(
        "apps.reviews.services.review_service.CloudinaryService.upload_image",
    )
    def test_reviews_and_photos_do_not_mutate_existing_vouch(
        self,
        mock_upload,
    ):
        vouch = self._create_vouch()
        original_snapshot = vouch.VOUCH_REPUTATION_SNAPSHOT

        review = self._create_review()

        mock_upload.return_value = {
            "secure_url": "https://example.com/independent-photo.jpg",
            "public_id": "sugbogo/reviews/independent-photo",
        }

        ReviewService.update_review(
            user=self.explorer,
            review_id=review.REVW_ID,
            photos=[
                object(),
            ],
        )
        vouch.refresh_from_db()

        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            original_snapshot,
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )
        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )
