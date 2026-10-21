from datetime import timedelta
from django.test import TestCase

from apps.business.models import BusinessSpecialtyTag
from apps.business.services.visibility_event_service import VisibilityTrackingUnavailable
from apps.merchant_operations.dashboard.services.recent_activity_service import (
    RecentActivityService,
)
from apps.notifications.models import Notification
from apps.reviews.models import Review

from .fixtures import RecentActivityFixtures


class RecentActivityServiceTests(RecentActivityFixtures, TestCase):
    """Cover current source eligibility, grouping, stable limits, and degraded tracking."""

    def test_merges_only_five_newest_rows_across_sources(self):
        old = self.review(self.NOW - timedelta(days=90))
        first = self.review(self.NOW - timedelta(hours=1))
        second = self.review(self.NOW - timedelta(hours=2))
        third = self.review(self.NOW - timedelta(hours=3))
        self.vouch(self.NOW - timedelta(minutes=30))
        self.save_days.return_value = [{
            "date": self.NOW.date().isoformat(),
            "count": 4,
            "occurred_at": self.NOW - timedelta(minutes=15),
        }]
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(
            [item["type"] for item in result["items"]],
            ["save", "vouch", "review", "review", "review"],
        )
        ids = [item["id"] for item in result["items"]]
        self.assertNotIn(f"review:{old.pk}", ids)
        self.assertEqual(
            ids[-3:],
            [f"review:{first.pk}", f"review:{second.pk}", f"review:{third.pk}"],
        )

    def test_review_publication_time_precedes_legacy_fallback_and_ignores_edits(self):
        recent = self.review(self.NOW - timedelta(days=10))
        legacy = self.review(self.NOW - timedelta(days=1))
        Review.objects.filter(pk=recent.pk).update(
            REVW_PUBLISHED_AT=self.NOW - timedelta(minutes=2),
        )
        Review.objects.filter(pk=legacy.pk).update(REVW_UPDATED_AT=self.NOW)
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(result["items"][0]["id"], f"review:{recent.pk}")
        self.assertEqual(result["items"][0]["time_basis"], "published_at")
        self.assertEqual(result["items"][1]["time_basis"], "created_at_fallback")

    def test_excludes_other_businesses_nonpublic_reviews_and_future_events(self):
        for status in (
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.REJECTED,
            Review.ReviewStatus.FLAGGED,
        ):
            self.review(self.NOW - timedelta(hours=1), status=status)
        self.review(self.NOW - timedelta(hours=1), business=self.business_b)
        self.review(self.NOW + timedelta(hours=1))
        self.vouch(self.NOW + timedelta(hours=1))
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(result["items"], [])

    def test_vouches_group_per_explorer_per_manila_day_independent_of_notifications(self):
        first = self.vouch(self.NOW - timedelta(hours=1))
        self.vouch(self.NOW - timedelta(minutes=1), tag=self.tags[1])
        self.vouch(
            self.NOW - timedelta(days=1),
            author=self.supporter_b,
        )
        before = RecentActivityService.get_snapshot(self.merchant_a)
        Notification.objects.create(
            USER_ID=self.merchant_a,
            NOTF_TYPE="business_vouch_received",
            NOTF_TITLE="New specialty vouch",
            NOTF_BODY="Previously acknowledged endorsement.",
            NOTF_DEDUP_KEY=f"business-vouch:{first.pk}:created",
            NOTF_READ_AT=self.NOW,
        )
        after = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(before, after)
        self.assertEqual(len(after["items"]), 2)
        self.assertEqual(after["items"][0]["count"], 2)
        self.assertIsNone(after["items"][0]["target"])

    def test_calendar_groups_use_manila_midnight_instead_of_utc_midnight(self):
        # NOW is 12:30 Manila; these timestamps straddle Manila midnight.
        self.vouch(self.NOW - timedelta(hours=13))
        self.vouch(self.NOW - timedelta(hours=12), tag=self.tags[1])
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(len(result["items"]), 2)
        self.assertNotEqual(result["items"][0]["date"], result["items"][1]["date"])

    def test_vouches_require_valid_evidence_and_current_active_specialties(self):
        self.vouch(self.NOW - timedelta(hours=1), valid=False)
        self.vouch(self.NOW - timedelta(hours=1), tag=self.tags[2])
        active = self.vouch(
            self.NOW - timedelta(minutes=1),
            author=self.supporter_b,
            tag=self.tags[1],
        )
        active.VOUCH_FLAG_SUSPICIOUS = True
        active.save(update_fields=["VOUCH_FLAG_SUSPICIOUS"])
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["count"], 1)
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business_a,
            TAG_ID=self.tags[1],
        ).update(BST_IS_ACTIVE=False)
        self.assertEqual(
            RecentActivityService.get_snapshot(self.merchant_a)["items"],
            [],
        )

    def test_tracking_failure_keeps_reviews_without_reporting_a_false_save_zero(self):
        self.review(self.NOW - timedelta(minutes=1))
        self.save_days.side_effect = VisibilityTrackingUnavailable()
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["sources"]["saves"]["availability"], "unavailable")
        self.assertFalse(any(item["type"] == "save" for item in result["items"]))

    def test_saves_are_anonymous_and_have_no_destination(self):
        self.save_days.return_value = [{
            "date": self.NOW.date().isoformat(),
            "count": 1,
            "occurred_at": self.NOW,
        }]
        item = RecentActivityService.get_snapshot(self.merchant_a)["items"][0]
        self.assertEqual(item["title"], "An explorer saved your business")
        self.assertIsNone(item["actor_name"])
        self.assertIsNone(item["target"])
        self.assertNotIn("explorer_id", item)

    def test_equal_review_timestamps_use_numeric_ids_before_applying_limit(self):
        reviews = [
            self.review(self.NOW - timedelta(minutes=1))
            for _ in range(12)
        ]
        result = RecentActivityService.get_snapshot(self.merchant_a)
        self.assertEqual(
            [item["id"] for item in result["items"]],
            [f"review:{review.pk}" for review in reversed(reviews[-5:])],
        )

    def test_review_excerpts_are_bounded_and_whitespace_normalized(self):
        review = self.review(self.NOW - timedelta(minutes=1))
        Review.objects.filter(pk=review.pk).update(REVW_TEXT="Helpful\n staff " * 40)
        item = RecentActivityService.get_snapshot(self.merchant_a)["items"][0]
        self.assertLessEqual(len(item["description"]), 160)
        self.assertNotIn("\n", item["description"])
        self.assertEqual(item["target"], {"type": "business_review", "id": review.pk})
