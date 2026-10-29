"""Admin API coverage for held-review queue, evidence, and decisions."""

from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.tests.test_manage_under_review_service import (
    create_under_review_context,
)
from apps.reviews.models import Review, ReviewPhoto, ReviewReply
from apps.users.models import User


class ManageUnderReviewViewTests(TestCase):
    """Protect permissions, filters, structured findings, and stale actions."""

    @classmethod
    def setUpTestData(cls):
        """Create representative account and business identities."""
        cls.owner, cls.author, cls.business = create_under_review_context()
        cls.admin = User.objects.create(
            USER_EMAIL="queue-admin@example.com",
            USER_FNAME="Queue",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.super_admin = User.objects.create(
            USER_EMAIL="queue-super@example.com",
            USER_FNAME="Super",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def setUp(self):
        """Authenticate an Admin and create a text-flagged held review."""
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.review = Review.objects.create(
            USER_ID=self.author,
            BUSN_ID=self.business,
            REVW_TEXT="Potentially abusive review text for Admin inspection.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={
                "outcome": "flagged",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "findings": [
                    {
                        "source": "text",
                        "flagged": True,
                        "categories": {
                            "harassment": True,
                            "violence": False,
                        },
                    },
                ],
            },
        )

    def test_admin_and_super_admin_see_only_held_reviews(self):
        """Queue access is role-bound and excludes public or rejected rows."""
        Review.objects.create(
            USER_ID=self.owner,
            BUSN_ID=self.business,
            REVW_TEXT="A published review.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        rejected_author = User.objects.create(
            USER_EMAIL="rejected-author@example.com",
            USER_FNAME="Rejected",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        Review.objects.create(
            USER_ID=rejected_author,
            BUSN_ID=self.business,
            REVW_TEXT="A rejected review.",
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )

        for actor in (self.admin, self.super_admin):
            with self.subTest(role=actor.USER_ROLE):
                self.client.force_authenticate(actor)
                response = self.client.get(reverse("admin-under-review-list"))
                self.assertEqual(response.status_code, 200)
                data = response.data["data"]
                self.assertEqual(data["pagination"]["total_items"], 1)
                self.assertEqual(data["items"][0]["id"], self.review.pk)
                self.assertNotIn("REVW_MODERATION_DATA", data["items"][0])
                self.assertNotIn("cover_photo_url", data["items"][0]["business"])

    def test_non_admin_and_anonymous_access_denied(self):
        """Ordinary accounts cannot read evidence or make decisions."""
        detail = reverse("admin-under-review-detail", args=[self.review.pk])
        approve = reverse("admin-under-review-approve", args=[self.review.pk])
        for actor in (self.owner, self.author, None):
            with self.subTest(actor=actor):
                self.client.force_authenticate(actor)
                expected = 401 if actor is None else 403
                self.assertEqual(
                    self.client.get(reverse("admin-under-review-list")).status_code,
                    expected,
                )
                self.assertEqual(self.client.get(detail).status_code, expected)
                self.assertEqual(self.client.post(approve).status_code, expected)

    def test_list_filters_search_sort_and_pagination(self):
        """Queue filters run before pagination with oldest-first default."""
        image_author = User.objects.create(
            USER_EMAIL="image-author@example.com",
            USER_FNAME="Photo",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        image_review = Review.objects.create(
            USER_ID=image_author,
            BUSN_ID=self.business,
            REVW_TEXT="A photo review awaiting inspection.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={
                "outcome": "flagged",
                "findings": [
                    {
                        "source": "image",
                        "photo_index": 0,
                        "flagged": True,
                        "categories": {"violence": True},
                    },
                ],
            },
        )
        photo = ReviewPhoto.objects.create(
            REVW_ID=image_review,
            RPHO_PHOTO_URL="https://example.com/flagged.jpg",
            RPHO_PHOTO_PUBLIC_ID="flagged-photo",
        )
        image_review.REVW_MODERATION_DATA["findings"][0]["photo_id"] = photo.pk
        image_review.save(update_fields=["REVW_MODERATION_DATA"])
        provider_author = User.objects.create(
            USER_EMAIL="provider-author@example.com",
            USER_FNAME="Provider",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        provider_review = Review.objects.create(
            USER_ID=provider_author,
            BUSN_ID=self.business,
            REVW_TEXT="A review held because moderation was unavailable.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
            REVW_MODERATION_DATA={
                "outcome": "provider_failure",
                "retryable": True,
                "findings": [],
            },
        )
        list_url = reverse("admin-under-review-list")

        response = self.client.get(list_url, {"page_size": 1})
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 3)
        self.assertEqual(response.data["data"]["items"][0]["id"], self.review.pk)
        self.assertTrue(response.data["data"]["pagination"]["has_next"])
        newest = self.client.get(list_url, {"ordering": "newest"})
        self.assertEqual(newest.data["data"]["items"][0]["id"], provider_review.pk)

        cases = (
            ({"reason": "text_flagged"}, [self.review.pk]),
            ({"reason": "image_flagged"}, [image_review.pk]),
            ({"reason": "provider_failure"}, [provider_review.pk]),
            ({"content": "has_photos"}, [image_review.pk]),
            ({"content": "text_only"}, [self.review.pk, provider_review.pk]),
            ({"search": "Photo"}, [image_review.pk]),
            ({"search": "Sugbo Bistro"}, [self.review.pk, image_review.pk, provider_review.pk]),
        )
        for filters, expected_ids in cases:
            with self.subTest(filters=filters):
                result = self.client.get(list_url, filters)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(
                    [item["id"] for item in result.data["data"]["items"]],
                    expected_ids,
                )
        self.assertEqual(
            self.client.get(list_url, {"reason": "invalid"}).status_code,
            400,
        )

    def test_detail_structures_text_photo_and_provider_evidence(self):
        """Detailed findings remain attributed and omit raw provider JSON."""
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/business-cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])

        safe_photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/safe.jpg",
            RPHO_PHOTO_PUBLIC_ID="safe-photo",
        )
        flagged_photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/flagged.jpg",
            RPHO_PHOTO_PUBLIC_ID="flagged-photo",
        )
        metadata = self.review.REVW_MODERATION_DATA
        metadata["findings"].extend([
            {
                "source": "image",
                "photo_id": safe_photo.pk,
                "flagged": False,
                "categories": {"violence": False},
                "category_scores": {"violence": 0.01},
            },
            {
                "source": "image",
                "photo_id": flagged_photo.pk,
                "flagged": True,
                "categories": {"violence": True},
                "category_scores": {"violence": 0.9},
            },
        ])
        self.review.REVW_MODERATION_DATA = metadata
        self.review.save(update_fields=["REVW_MODERATION_DATA"])

        response = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        )
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["text"], self.review.REVW_TEXT)
        self.assertEqual(
            data["business"],
            {
                "id": self.business.pk,
                "name": "Sugbo Bistro",
                "cover_photo_url": "https://example.com/business-cover.jpg",
                "cluster_name": "Food and Dining",
                "category_name": "Restaurants",
            },
        )
        self.assertEqual(data["moderation"]["text_flagged_categories"], ["harassment"])
        self.assertEqual(data["photos"][0]["flagged_categories"], [])
        self.assertEqual(data["photos"][1]["flagged_categories"], ["violence"])
        self.assertEqual(data["hold_reasons"], ["text_flagged", "image_flagged"])
        self.assertNotIn("category_scores", str(data))
        self.assertNotIn("REVW_MODERATION_DATA", str(data))

        self.assertEqual(data["like_count"], 0)
        self.assertFalse(data["is_edited"])
        self.assertIsNone(data["edited_at"])
        self.assertFalse(data["has_reply"])
        self.assertIsNone(data["reply"])

        self.review.REVW_MODERATION_DATA = {
            "outcome": "provider_failure",
            "retryable": True,
            "findings": [],
        }
        self.review.save(update_fields=["REVW_MODERATION_DATA"])
        provider = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(provider["hold_reasons"], ["provider_failure"])
        self.assertTrue(provider["moderation"]["provider_unavailable"])
        self.assertEqual(provider["moderation"]["retry_state"], "retrying")

    def test_review_context_is_admin_only_and_keeps_queue_compact(self):
        """List shows presence; detail shows likes and an existing reply."""
        edited_at = timezone.now()
        Review.objects.filter(pk=self.review.pk).update(
            REVW_LIKE_COUNT=2,
            REVW_EDITED_AT=edited_at,
        )
        reply = ReviewReply.objects.create(
            REVW_ID=self.review,
            RPLY_TEXT="Thank you for telling us about your visit.",
        )

        list_data = self.client.get(
            reverse("admin-under-review-list"),
        ).data["data"]["items"][0]
        self.assertTrue(list_data["has_reply"])
        self.assertTrue(list_data["is_edited"])
        self.assertNotIn("like_count", list_data)
        self.assertNotIn("reply", list_data)
        self.assertNotIn("edited_at", list_data)

        detail = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(detail["like_count"], 2)
        self.assertTrue(detail["is_edited"])
        self.assertIsNotNone(detail["edited_at"])
        self.assertEqual(detail["reply"]["id"], reply.pk)
        self.assertEqual(detail["reply"]["text"], reply.RPLY_TEXT)
        self.assertIsNotNone(detail["reply"]["created_at"])
        self.assertNotIn("REVW_EDITED_AT", detail)

    def test_local_safety_reason_is_structured_and_filterable(self):
        """Admin evidence identifies the local source without raw review text."""
        self.review.REVW_MODERATION_DATA = {
            "outcome": "flagged",
            "findings": [
                {
                    "source": "local_cebuano_safety",
                    "photo_index": None,
                    "flagged": True,
                    "category": "violence_threat",
                    "matched_rule": "direct_kill_threat",
                },
                {
                    "source": "text",
                    "photo_index": None,
                    "flagged": False,
                    "categories": {"violence": False},
                },
            ],
        }
        self.review.save(update_fields=["REVW_MODERATION_DATA"])

        list_response = self.client.get(
            reverse("admin-under-review-list"),
            {"reason": "local_cebuano_safety"},
        )
        self.assertEqual(list_response.status_code, 200)
        items = list_response.data["data"]["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["hold_reasons"], ["local_cebuano_safety"])
        self.assertNotIn("REVW_MODERATION_DATA", items[0])

        detail = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(
            detail["moderation"]["local_safety_findings"],
            [
                {
                    "category": "violence_threat",
                    "matched_rule": "direct_kill_threat",
                },
            ],
        )
        self.assertEqual(detail["moderation"]["text_flagged_categories"], [])
        self.assertFalse(detail["moderation"]["provider_unavailable"])

        self.review.REVW_MODERATION_DATA["outcome"] = "provider_failure"
        self.review.REVW_MODERATION_DATA["retryable"] = True
        self.review.save(update_fields=["REVW_MODERATION_DATA"])
        unavailable = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(
            unavailable["hold_reasons"],
            ["local_cebuano_safety", "provider_failure"],
        )
        self.assertTrue(unavailable["moderation"]["provider_unavailable"])
        self.assertEqual(unavailable["moderation"]["retry_state"], "retrying")

    def test_decision_endpoints_are_audited_and_stale_safe(self):
        """API decisions return statuses and refuse duplicate transitions."""
        approve = reverse("admin-under-review-approve", args=[self.review.pk])
        reject = reverse("admin-under-review-reject", args=[self.review.pk])
        response = self.client.post(approve)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["status"], "published")
        self.assertEqual(
            self.client.post(reject, {
                "moderation_notes": "This content violates community guidelines.",
            }).status_code,
            400,
        )
        self.assertEqual(
            AdminActivity.objects.get().AACT_ACTION,
            AdminActivity.Action.REVIEW_MODERATION_APPROVED,
        )
        self.assertEqual(
            self.client.get(reverse("admin-under-review-detail", args=[self.review.pk])).status_code,
            200,
        )

    def test_status_filters_include_only_pending_and_manual_decisions(self):
        """History excludes automatic decisions while the default count stays pending."""
        automatic = Review.objects.create(
            USER_ID=self.owner,
            BUSN_ID=self.business,
            REVW_TEXT="An automatically published review.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        approved = Review.objects.create(
            USER_ID=self.admin,
            BUSN_ID=self.business,
            REVW_TEXT="A manually approved review.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        rejected = Review.objects.create(
            USER_ID=self.super_admin,
            BUSN_ID=self.business,
            REVW_TEXT="A manually rejected review.",
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        for review, action in (
            (approved, AdminActivity.Action.REVIEW_MODERATION_APPROVED),
            (rejected, AdminActivity.Action.REVIEW_MODERATION_REJECTED),
        ):
            AdminActivity.objects.create(
                ACTOR_ID=self.admin,
                TARGET_USER_ID=review.USER_ID,
                AACT_ACTION=action,
                AACT_CONTEXT={"review_id": review.pk},
            )
        list_url = reverse("admin-under-review-list")
        for filters, expected in (
            ({}, [self.review.pk]),
            ({"status": "pending"}, [self.review.pk]),
            ({"status": "approved"}, [approved.pk]),
            ({"status": "rejected"}, [rejected.pk]),
            ({"status": "all"}, [self.review.pk, approved.pk, rejected.pk]),
            ({"status": "all", "search": "manually rejected"}, [rejected.pk]),
        ):
            with self.subTest(filters=filters):
                response = self.client.get(list_url, filters)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    [item["id"] for item in response.data["data"]["items"]],
                    expected,
                )
                self.assertEqual(
                    response.data["data"]["pagination"]["total_items"],
                    len(expected),
                )
        self.assertEqual(
            self.client.get(list_url, {"status": "invalid"}).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                reverse("admin-under-review-detail", args=[automatic.pk]),
            ).status_code,
            404,
        )

    def test_completed_detail_uses_recorded_reviewer_time_and_notes(self):
        """Completed detail preserves audit attribution and refuses another decision."""
        notes = "The content contains a direct threat."
        self.client.post(
            reverse("admin-under-review-reject", args=[self.review.pk]),
            {"moderation_notes": notes},
        )
        activity = AdminActivity.objects.get()
        self.review.refresh_from_db()
        self.review.REVW_MODERATION_NOTES = "Later unrelated moderation notes."
        self.review.save(update_fields=["REVW_MODERATION_NOTES"])
        response = self.client.get(
            reverse("admin-under-review-detail", args=[self.review.pk]),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["decision_status"], "rejected")
        decision = response.json()["data"]["decision"]
        self.assertEqual(decision["status"], "rejected")
        self.assertEqual(decision["reviewed_by"]["id"], self.admin.pk)
        self.assertEqual(decision["reviewed_by"]["first_name"], "Queue")
        self.assertEqual(decision["notes"], notes)
        self.assertTrue(decision["reviewed_at"])
        self.assertEqual(
            self.client.post(
                reverse("admin-under-review-approve", args=[self.review.pk]),
            ).status_code,
            400,
        )
        self.assertEqual(AdminActivity.objects.get().pk, activity.pk)

    def test_reject_endpoint_keeps_unpublished_count(self):
        """Rejecting held content records the decision without count loss."""
        response = self.client.post(
            reverse("admin-under-review-reject", args=[self.review.pk]),
            {"moderation_notes": "  The content contains a direct threat.  "},
        )
        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)
        self.review.refresh_from_db()
        self.assertEqual(
            self.review.REVW_MODERATION_NOTES,
            "The content contains a direct threat.",
        )
        self.assertEqual(
            AdminActivity.objects.get().AACT_ACTION,
            AdminActivity.Action.REVIEW_MODERATION_REJECTED,
        )

    def test_reject_endpoint_validates_notes_and_keeps_them_internal(self):
        """Only rejection accepts a substantive Admin-only note."""
        url = reverse("admin-under-review-reject", args=[self.review.pk])
        for payload in (
            {},
            {"moderation_notes": "   "},
            {"moderation_notes": "  Too short  "},
            {"moderation_notes": "x" * 2001},
        ):
            with self.subTest(payload=payload):
                response = self.client.post(url, payload)
                self.assertEqual(response.status_code, 400)

        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        self.assertEqual(AdminActivity.objects.count(), 0)

        response = self.client.post(url, {
            "moderation_notes": "x" * 2000,
        })
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("moderation_notes", response.data["data"])
        self.review.refresh_from_db()
        self.assertEqual(len(self.review.REVW_MODERATION_NOTES), 2000)
