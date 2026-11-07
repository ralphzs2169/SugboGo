from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.paginator import Paginator
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.unified_activity_service import (
    UnifiedActivityService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    PocketCollection,
    PocketMembership,
    SpecialtyTag,
)
from apps.merchant_operations.business_profile.models import BusinessNameChangeRequest
from apps.reviews.models import Review, ReviewLike
from apps.users.models import User


class UnifiedExplorerActivityTests(TestCase):
    """Verify retained Explorer receipts without inventing missing history or current-role snapshots."""

    @classmethod
    def setUpTestData(cls):
        """Create retained actions that remain historical despite current eligibility and visibility changes."""
        AnalyticsPolicyChange.objects.all().delete()
        cls.now = timezone.now().replace(microsecond=0) - timedelta(days=1)
        cls.actor = User.objects.create(
            USER_EMAIL="unified-explorer@example.com",
            USER_FNAME="Current",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.DISABLED,
            password="!",
        )
        cls.owner = User.objects.create(
            USER_EMAIL="unified-explorer-business-owner@example.com",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cluster = Cluster.objects.create(CLUS_NAME="Explorer source fixtures")
        category = Category.objects.create(
            CLUS_ID=cluster,
            CTGRY_NAME="Explorer source category",
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.9, 10.3, srid=4326),
            LOCT_ADDRESS="Current business address",
        )
        cls.business = Business.objects.create(
            USER_ID=cls.owner,
            CTGRY_ID=category,
            LOCT_ID=location,
            BUSN_NAME="Current business name",
            BUSN_CONTACT_NUMBER="09123456789",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        cls.tag = SpecialtyTag.objects.create(TAG_NAME="Current specialty label")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.tag,
            BST_IS_ACTIVE=False,
        )
        cls.review = Review.objects.create(
            REVW_ID=42,
            USER_ID=cls.actor,
            BUSN_ID=cls.business,
            REVW_TEXT="private-review-text",
            REVW_STATUS=Review.ReviewStatus.REJECTED,
            REVW_SHOW_IN_COMMUNITY=False,
            REVW_MODERATION_NOTES="private-moderation-notes",
            REVW_MODERATION_DATA={"findings": "private-provider-data"},
            REVW_INSTALLATION_ID="private-review-device-id",
        )
        Review.objects.filter(pk=cls.review.pk).update(
            REVW_CREATED_AT=cls.now - timedelta(hours=4),
            REVW_PUBLISHED_AT=cls.now - timedelta(hours=3),
            REVW_EDITED_AT=cls.now - timedelta(minutes=30),
            REVW_UPDATED_AT=cls.now,
        )
        cls.vouch = BusinessVouch.objects.create(
            VOUCH_ID=42,
            USER_ID=cls.actor,
            BUSN_ID=cls.business,
            TAG_ID=cls.tag,
            VOUCH_REPUTATION_SNAPSHOT="0.50000",
            VOUCH_WITHDRAWN_AT=cls.now - timedelta(hours=1),
            VOUCH_RELIABILITY_EVIDENCE={"details": "private-reliability-evidence"},
            VOUCH_INSTALLATION_ID="private-vouch-device-id",
        )
        BusinessVouch.objects.filter(pk=cls.vouch.pk).update(
            VOUCH_CREATED_AT=cls.now - timedelta(hours=3),
        )
        cls.saved = BusinessPocket.objects.create(
            PCKT_ID=42,
            USER_ID=cls.actor,
            BUSN_ID=cls.business,
        )
        BusinessPocket.objects.filter(pk=cls.saved.pk).update(
            PCKT_CREATED_AT=cls.now - timedelta(hours=2),
        )
        for name in ("private-personal-collection-a", "private-personal-collection-b"):
            collection = PocketCollection.objects.create(
                USER_ID=cls.actor,
                PCOL_NAME=name,
            )
            PocketMembership.objects.create(
                PCOL_ID=collection,
                PCKT_ID=cls.saved,
            )
        cls.like = ReviewLike.objects.create(
            RLIK_ID=42,
            USER_ID=cls.actor,
            REVW_ID=cls.review,
        )
        ReviewLike.objects.filter(pk=cls.like.pk).update(RLIK_CREATED_AT=cls.now)

    def test_explorer_receipts_have_accurate_identity_time_and_safe_provenance(self):
        with CaptureQueriesContext(connection) as queries:
            rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(queries), 1)
        self.assertIn("UNION ALL", queries[0]["sql"])
        expected = [
            ("review_like", "review_liked", self.now),
            ("business_vouch", "business_vouch_withdrawn", self.now - timedelta(hours=1)),
            ("business_pocket", "business_saved", self.now - timedelta(hours=2)),
            ("business_vouch", "business_vouch_submitted", self.now - timedelta(hours=3)),
            ("review", "review_submitted", self.now - timedelta(hours=4)),
        ]
        self.assertEqual(
            [
                (row["source_type"], row["occurrence"], row["occurred_at"])
                for row in rows
            ],
            expected,
        )
        source_details = {
            "review": ("review", "42", "reviews.review", "reviews"),
            "business_vouch": ("business_vouch", "42", "business.businessvouch", "business"),
            "business_pocket": (
                "business",
                str(self.business.pk),
                "business.businesspocket",
                "pocket",
            ),
            "review_like": ("review", "42", "reviews.reviewlike", "community"),
        }
        for row in rows:
            with self.subTest(source=row["source_type"], occurrence=row["occurrence"]):
                target_type, target_id, model, module = source_details[row["source_type"]]
                self.assertEqual(tuple(row), UnifiedActivityService.COLUMNS)
                self.assertEqual(row["source_id"], "42")
                self.assertEqual(row["actor_id"], self.actor.pk)
                self.assertEqual(row["target_type"], target_type)
                self.assertEqual(row["target_id"], target_id)
                self.assertEqual(row["module"], module)
                self.assertEqual(row["provenance"]["model"], model)
                self.assertEqual(row["provenance"]["business_id"], self.business.pk)
                self.assertFalse(row["is_administrative"])
                for field in (
                    "actor_display_snapshot",
                    "actor_role_snapshot",
                    "target_label",
                    "outcome",
                    "new_state",
                ):
                    self.assertIsNone(row[field])
                if row["source_type"] == "business_vouch":
                    self.assertEqual(row["provenance"]["specialty_tag_id"], self.tag.pk)
                if row["source_type"] == "review_like":
                    self.assertEqual(row["provenance"]["review_id"], self.review.pk)
        self.assertNotIn("private-", repr(rows))

    def test_review_edits_and_community_visibility_do_not_create_extra_occurrences(self):
        Review.objects.filter(pk=self.review.pk).update(
            REVW_EDITED_AT=self.now + timedelta(hours=1),
            REVW_UPDATED_AT=self.now + timedelta(hours=2),
            REVW_SHOW_IN_COMMUNITY=True,
        )
        rows = list(UnifiedActivityService.list_activity())
        review_rows = [
            row
            for row in rows
            if row["source_type"] == "review"
        ]

        self.assertEqual(len(rows), 5)
        self.assertEqual(len(review_rows), 1)
        self.assertEqual(review_rows[0]["occurrence"], "review_submitted")
        self.assertEqual(review_rows[0]["occurred_at"], self.now - timedelta(hours=4))
        self.assertIsNone(review_rows[0]["new_state"])

    def test_vouches_preserve_only_original_submission_and_retained_withdrawal(self):
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_WITHDRAWN_AT=None,
            VOUCH_UPDATED_AT=self.now,
        )
        vouches = [
            row
            for row in UnifiedActivityService.list_activity()
            if row["source_type"] == "business_vouch"
        ]

        self.assertEqual(len(vouches), 1)
        self.assertEqual(vouches[0]["occurrence"], "business_vouch_submitted")
        self.assertEqual(vouches[0]["occurred_at"], self.now - timedelta(hours=3))

        latest_withdrawal = self.now + timedelta(hours=1)
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_WITHDRAWN_AT=latest_withdrawal,
            VOUCH_UPDATED_AT=latest_withdrawal,
        )
        vouches = [
            row
            for row in UnifiedActivityService.list_activity()
            if row["source_type"] == "business_vouch"
        ]
        self.assertEqual(len(vouches), 2)
        self.assertEqual(vouches[0]["occurrence"], "business_vouch_withdrawn")
        self.assertEqual(vouches[0]["occurred_at"], latest_withdrawal)
        self.assertEqual(vouches[1]["occurred_at"], self.now - timedelta(hours=3))

    def test_pocket_memberships_do_not_duplicate_saves_or_reconstruct_removals(self):
        BusinessPocket.objects.filter(pk=self.saved.pk).update(
            PCKT_UPDATED_AT=self.now + timedelta(hours=1),
        )
        saves = [
            row
            for row in UnifiedActivityService.list_activity()
            if row["source_type"] == "business_pocket"
        ]
        self.assertEqual(len(saves), 1)
        self.assertEqual(saves[0]["occurred_at"], self.now - timedelta(hours=2))
        self.assertEqual(PocketMembership.objects.filter(PCKT_ID=self.saved).count(), 2)

        BusinessPocket.objects.filter(pk=self.saved.pk).delete()
        rows = list(UnifiedActivityService.list_activity())
        self.assertFalse(any(row["source_type"] == "business_pocket" for row in rows))
        self.assertFalse(any("removed" in row["occurrence"] for row in rows))

    def test_deleted_likes_do_not_become_invented_unlike_events(self):
        ReviewLike.objects.filter(pk=self.like.pk).delete()
        rows = list(UnifiedActivityService.list_activity())

        self.assertEqual(len(rows), 4)
        self.assertFalse(any(row["source_type"] == "review_like" for row in rows))
        self.assertEqual(
            len([row for row in rows if row["occurrence"] == "review_submitted"]),
            1,
        )

    def test_durable_author_deletion_is_reused_once_without_private_context(self):
        deletion = AdminActivity.objects.create(
            ACTOR_ID=self.actor,
            TARGET_USER_ID=self.actor,
            AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
            AACT_CONTEXT={
                "review_id": 999,
                "business_id": self.business.pk,
                "previous_review_status": "under_review",
                "moderation_notes": "private-deleted-review-context",
            },
        )
        AdminActivity.objects.filter(pk=deletion.pk).update(AACT_CREATED_AT=self.now)
        rows = list(UnifiedActivityService.list_activity())
        deleted = [
            row
            for row in rows
            if row["occurrence"] == "review_deleted_by_author"
        ]

        self.assertEqual(len(rows), 6)
        self.assertEqual(len(deleted), 1)
        self.assertEqual(deleted[0]["source_type"], "admin_activity")
        self.assertEqual(deleted[0]["source_id"], str(deletion.pk))
        self.assertEqual(deleted[0]["actor_id"], self.actor.pk)
        self.assertEqual(deleted[0]["occurred_at"], self.now)
        self.assertFalse(deleted[0]["is_administrative"])
        self.assertIsNone(deleted[0]["actor_role_snapshot"])
        self.assertEqual(deleted[0]["module"], "reviews")
        self.assertEqual(deleted[0]["target_type"], "review")
        self.assertEqual(deleted[0]["target_id"], "999")
        self.assertNotIn("private-", repr(rows))

    def test_ordering_and_database_pagination_preserve_merchant_admin_and_explorer_occurrences(self):
        Review.objects.update(REVW_CREATED_AT=self.now)
        BusinessVouch.objects.update(VOUCH_CREATED_AT=self.now, VOUCH_WITHDRAWN_AT=self.now)
        BusinessPocket.objects.update(PCKT_CREATED_AT=self.now)
        ReviewLike.objects.update(RLIK_CREATED_AT=self.now)
        admin = User.objects.create(
            USER_EMAIL="unified-explorer-admin@example.com",
            USER_FNAME="Admin",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        activity = AdminActivity.objects.create(
            AACT_ID=42,
            ACTOR_ID=admin,
            AACT_ACTION=AdminActivity.Action.BUSINESS_SUSPENDED,
            AACT_ACTOR_ROLE=User.UserRole.ADMIN,
            AACT_NEW_STATE={"status": "suspended"},
        )
        AdminActivity.objects.filter(pk=activity.pk).update(AACT_CREATED_AT=self.now)
        BusinessNameChangeRequest.objects.create(
            BNCR_ID=42,
            USER_ID=self.owner,
            BUSN_ID=self.business,
            BNCR_STATUS=BusinessNameChangeRequest.Status.WITHDRAWN,
            BNCR_PREVIOUS_BUSINESS_NAME="Submitted baseline name",
            BNCR_PROPOSED_BUSINESS_NAME="Submitted proposed name",
            BNCR_SUBMITTED_AT=self.now,
            BNCR_RESOLVED_AT=self.now,
        )
        expected = [
            ("admin_activity", "business_suspended"),
            ("business_name_change_request", "business_name_change_request_submitted"),
            ("business_name_change_request", "business_name_change_request_withdrawn"),
            ("business_pocket", "business_saved"),
            ("business_vouch", "business_vouch_submitted"),
            ("business_vouch", "business_vouch_withdrawn"),
            ("review", "review_submitted"),
            ("review_like", "review_liked"),
        ]
        paginator = Paginator(UnifiedActivityService.list_activity(), 3)
        with CaptureQueriesContext(connection) as queries:
            rows = [
                row
                for page_number in paginator.page_range
                for row in paginator.page(page_number).object_list
            ]

        self.assertEqual(len(queries), 4)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        self.assertIn("LIMIT 2 OFFSET 6", queries[-1]["sql"])
        self.assertEqual(paginator.count, 8)
        self.assertEqual(
            [(row["source_type"], row["occurrence"]) for row in rows],
            expected,
        )
        identities = {
            (row["source_type"], row["source_id"], row["occurrence"])
            for row in rows
        }
        self.assertEqual(len(identities), 8)
        self.assertEqual({row["source_id"] for row in rows}, {"42"})
        self.assertEqual(rows[0]["actor_id"], admin.pk)
        self.assertEqual(rows[0]["actor_role_snapshot"], "admin")
        self.assertTrue(rows[0]["is_administrative"])
        self.assertEqual(rows[1]["actor_id"], self.owner.pk)
        self.assertIsNone(rows[1]["actor_role_snapshot"])
        self.assertEqual(rows[2]["new_state"], {"status": "withdrawn"})
