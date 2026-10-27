from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.notifications.models import Notification
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.services.tests.test_review_snapshots import SnapshotFixtures
from apps.reviews.services.review_service import ReviewService
from apps.users.models import ReputationEvent


class ReviewSnapshotAPITests(SnapshotFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)
        self.dispute = self.file_dispute()

    def detail_url(self):
        return reverse("admin-review-dispute-detail", args=[self.dispute.pk])

    def decide(
        self,
        action="uphold",
        **overrides,
    ):
        payload = {
            "expected_fingerprint": self.token(),
            "admin_notes": "The current review was inspected and the decision is justified.",
            **overrides,
        }
        return self.client.post(
            reverse(f"admin-review-dispute-{action}", args=[self.dispute.pk]),
            payload,
            format="json",
        )

    def test_detail_exposes_explicit_versions_and_current_decision_token(self):
        response = self.client.get(self.detail_url())
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(data["review_at_filing"]["available"])
        self.assertEqual(data["review_at_filing"]["photos"][0]["id"], self.photo.pk)
        self.assertEqual(data["current_review"]["text"], self.review.REVW_TEXT)
        self.assertTrue(data["current_review"]["exists"])
        self.assertEqual(data["current_content_fingerprint"], self.token())
        self.assertFalse(data["material_content_changed"])
        self.assertTrue(data["decision_eligible"])
        self.assertNotIn("public_id", data["review_at_filing"]["photos"][0])

    def test_missing_expected_fingerprint_is_rejected_for_both_actions(self):
        for action in ("uphold", "dismiss"):
            with self.subTest(action=action):
                response = self.client.post(
                    reverse(f"admin-review-dispute-{action}", args=[self.dispute.pk]),
                    {"admin_notes": "Sufficiently detailed inspection notes."},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("expected_fingerprint", response.data["errors"])
        self.assertFalse(AdminActivity.objects.exists())

    def test_invalid_expected_fingerprint_is_rejected(self):
        for token in (None, "", "123", "g" * 64):
            with self.subTest(token=token):
                self.assertEqual(self.decide(expected_fingerprint=token).status_code, 400)

    def test_stale_fingerprint_returns_conflict_for_both_decisions(self):
        token = self.token()
        self.edit(text="Updated public content while investigation was open.")
        for action in ("uphold", "dismiss"):
            with self.subTest(action=action):
                response = self.decide(action, expected_fingerprint=token)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.data["code"], "REVIEW_CONTENT_CHANGED")
                self.assertIn("Refresh", response.data["message"])
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())

    def test_changed_uphold_requires_explicit_acknowledgement(self):
        self.edit(text="Revised review still requiring investigation.")
        response = self.decide()
        self.assertEqual(response.status_code, 400)
        self.assertIn("acknowledge_review_changes", response.data["errors"])
        response = self.decide(acknowledge_review_changes=True)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["data"]["material_content_changed"])
        self.assertFalse(response.data["data"]["decision_eligible"])

    def test_acknowledgement_does_not_replace_meaningful_notes(self):
        self.edit(text="Changed review needs a reasoned decision.")
        response = self.decide(acknowledge_review_changes=True, admin_notes="Too short")
        self.assertEqual(response.status_code, 400)
        self.assertIn("admin_notes", response.data["errors"])
        self.assertFalse(AdminActivity.objects.exists())

    def test_changed_review_can_be_dismissed_without_acknowledgement(self):
        self.edit(text="Changed review may still be valid.")
        response = self.decide("dismiss")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["current_review"]["status"], "published")

    def test_unchanged_review_uphold_keeps_existing_rejection_behavior(self):
        response = self.decide()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["current_review"]["status"], "rejected")
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(ReputationEvent.objects.count(), 1)

    def test_legacy_uphold_requires_acknowledgement_but_has_no_fabricated_snapshot(self):
        self.dispute.snapshot.delete()
        response = self.client.get(self.detail_url())
        data = response.data["data"]
        self.assertTrue(data["filing_snapshot_unavailable"])
        self.assertEqual(data["review_at_filing"]["message"], "Filing-time snapshot unavailable")
        self.assertIsNone(data["material_content_changed"])
        self.assertEqual(self.decide().status_code, 400)
        self.assertEqual(self.decide(acknowledge_review_changes=True).status_code, 200)

    def test_deleted_review_detail_and_queue_remain_accessible_to_admin(self):
        ReviewService.delete_review(self.explorer, self.review.pk)
        response = self.client.get(self.detail_url())
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["status"], "author_deleted")
        self.assertEqual(data["current_review"], {"exists": False})
        self.assertIsNone(data["review"])
        self.assertFalse(data["decision_eligible"])
        response = self.client.get(reverse("admin-review-dispute-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["items"][0]["review_id"], self.review.pk)
        for action in ("uphold", "dismiss"):
            response = self.client.post(
                reverse(f"admin-review-dispute-{action}", args=[self.dispute.pk]),
                {
                    "expected_fingerprint": "0" * 64,
                    "admin_notes": "The original review was already removed.",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 400)

    def test_removed_business_and_merchant_serialize_without_broken_relations(self):
        self.business.delete()
        self.merchant.delete()
        response = self.client.get(self.detail_url())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"]["business"])
        self.assertIsNone(response.data["data"]["merchant"])
        self.assertEqual(
            self.client.get(reverse("admin-review-dispute-list")).status_code,
            200,
        )

    def test_snapshot_is_absent_from_merchant_and_public_review_contracts(self):
        self.client.force_authenticate(self.merchant)
        response = self.client.get(self.detail_url())
        self.assertEqual(response.status_code, 403)
        response = self.client.get(reverse("review-dispute-detail", args=[self.dispute.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("review_at_filing", response.data["data"])
        self.client.force_authenticate(self.explorer)
        response = self.client.get(reverse("review-preview", args=[self.business.pk]))
        self.assertEqual(response.status_code, 200)
        for review in response.data["data"]["reviews"]:
            self.assertNotIn("snapshot", review)
            self.assertNotIn("review_at_filing", review)

    def test_history_contains_the_snapshot_for_each_attempt(self):
        self.decide("dismiss")
        original_id = self.dispute.pk
        self.edit(text="The second attempt challenges this edited content.")
        self.dispute = self.file_dispute()
        response = self.client.get(self.detail_url())
        data = response.data["data"]
        previous = data["previous_disputes"][0]
        self.assertEqual(previous["id"], original_id)
        self.assertNotEqual(
            previous["review_at_filing"]["text"],
            data["review_at_filing"]["text"],
        )
        self.assertEqual(MerchantReviewDispute.objects.count(), 2)
