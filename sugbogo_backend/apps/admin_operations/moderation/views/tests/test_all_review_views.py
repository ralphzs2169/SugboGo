"""Protect the complete, read-only Admin review directory contract."""

from datetime import datetime, timedelta, timezone as datetime_timezone

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.serializers.all_review_serializers import (
    AdminAllReviewDetailSerializer,
    AdminAllReviewListSerializer,
)
from apps.admin_operations.moderation.services.all_review_service import AllReviewService
from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import (
    ReportFixtures,
)
from apps.reviews.models import Review, ReviewPhoto, ReviewReport
from apps.review_disputes.models import MerchantReviewDispute
from apps.users.models import User


class AllReviewViewTests(ReportFixtures, TestCase):
    """Exercise directory metrics, filters, privacy, and moderation integration."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.list_url = reverse("admin-all-review-list")
        self.summary_url = reverse("admin-all-review-summary")
        self.detail_url = reverse("admin-all-review-detail", args=[self.review.pk])
        self.held = self.create_review("Held mango review", "under_review")
        self.flagged = self.create_review("Flagged review", "flagged")
        self.rejected = self.create_review("Rejected review", "rejected")
        self.anchor = datetime(2026, 10, 10, 16, tzinfo=datetime_timezone.utc)
        for index, review in enumerate(self.reviews):
            Review.objects.filter(pk=review.pk).update(
                REVW_CREATED_AT=self.anchor + timedelta(days=index),
            )

    @property
    def reviews(self):
        return [self.review, self.held, self.flagged, self.rejected]

    def create_review(
        self,
        text,
        status,
    ):
        author = User.objects.create_user(
            email=f"directory-{User.objects.count()}@example.com",
            password=None,
            USER_FNAME="Directory",
            USER_LNAME=status,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT=text,
            REVW_STATUS=status,
        )

    def add_report(
        self,
        review,
        status,
    ):
        reporter = User.objects.create_user(
            email=f"directory-reporter-{User.objects.count()}@example.com",
            password=None,
            USER_FNAME="Private",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return ReviewReport.objects.create(
            REVW_ID=review,
            USER_ID=reporter,
            RREP_TYPE=ReviewReport.ReportType.OTHER,
            RREP_STATUS=status,
            RREP_EXPLANATION="Specific report explanation.",
            RREP_NOTES="An existing administrator decision note.",
            RREP_INSTALLATION_ID="never-expose-report-device",
        )

    def ids(
        self,
        params=None,
    ):
        response = self.client.get(self.list_url, params or {})
        self.assertEqual(response.status_code, 200)
        return [
            row["id"]
            for row in response.data["data"]["items"]
        ]

    def test_admin_and_super_admin_can_read_every_endpoint(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.admin.USER_ROLE = role
            for url in (self.list_url, self.summary_url, self.detail_url):
                with self.subTest(role=role, url=url):
                    self.assertEqual(self.client.get(url).status_code, 200)

    def test_anonymous_and_non_admin_roles_cannot_read(self):
        self.client.force_authenticate(user=None)
        for url in (self.list_url, self.summary_url, self.detail_url):
            self.assertEqual(self.client.get(url).status_code, 401)
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            self.user.USER_ROLE = role
            self.client.force_authenticate(self.user)
            for url in (self.list_url, self.summary_url, self.detail_url):
                with self.subTest(role=role, url=url):
                    self.assertEqual(self.client.get(url).status_code, 403)

    def test_inactive_admin_is_denied(self):
        self.admin.USER_STATUS = User.UserStatus.SUSPENDED
        for url in (self.list_url, self.summary_url, self.detail_url):
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_metrics_count_distinct_retained_reviews_and_overlap(self):
        self.add_report(self.review, "rejected")
        self.add_report(self.held, "approved")
        self.add_report(self.flagged, "withdrawn")
        self.add_report(self.rejected, "pending")
        response = self.client.get(
            self.summary_url,
            {"status": "rejected", "page_size": 1, "search": "missing"},
        )
        self.assertEqual(response.data["data"], {
            "total_reviews": 4,
            "published": 1,
            "under_review": 1,
            "reported": 4,
        })
        self.assertEqual(
            self.client.get(self.list_url).data["data"]["pagination"]["total_items"],
            4,
        )

    def test_empty_metrics_are_zero(self):
        Review.objects.all().delete()
        self.assertEqual(self.client.get(self.summary_url).data["data"], {
            "total_reviews": 0,
            "published": 0,
            "under_review": 0,
            "reported": 0,
        })
        response = self.client.get(self.list_url)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)

    def test_row_contains_loaded_identities_and_authoritative_counts(self):
        self.add_report(self.review, "approved")
        Review.objects.filter(pk=self.review.pk).update(REVW_REPORT_COUNT=99)
        first = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/first.jpg",
            RPHO_PHOTO_PUBLIC_ID="private-media-id",
        )
        ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/second.jpg",
            RPHO_PHOTO_PUBLIC_ID="private-second-id",
        )
        row = self.client.get(
            self.list_url,
            {"ordering": "oldest"},
        ).data["data"]["items"][0]
        self.assertEqual(set(row), {
            "id", "text", "author", "business", "status", "submitted_at",
            "first_photo_url", "photo_count", "report_count", "pending_report_count",
        })
        self.assertEqual(row["id"], self.review.pk)
        self.assertEqual(row["text"], self.review.REVW_TEXT)
        self.assertEqual(row["photo_count"], 2)
        self.assertEqual(row["first_photo_url"], first.RPHO_PHOTO_URL)
        self.assertEqual(row["report_count"], 2)
        self.assertEqual(row["pending_report_count"], 1)
        self.assertEqual(row["author"]["id"], self.second_user.pk)
        self.assertEqual(row["author"]["email"], self.second_user.USER_EMAIL)
        self.assertEqual(row["author"]["name"], self.second_user.full_name)
        self.assertEqual(row["business"], {
            "id": self.business.pk,
            "name": self.business.BUSN_NAME,
            "cover_photo_url": None,
            "category_name": self.category.CTGRY_NAME,
            "cluster_name": self.cluster.CLUS_NAME,
        })

    def test_optional_images_are_null_and_present_images_are_returned(self):
        detail = self.client.get(self.detail_url).data["data"]
        self.assertIsNone(detail["author"]["avatar_url"])
        self.assertIsNone(detail["business"]["cover_photo_url"])
        self.assertIsNone(detail["first_photo_url"])
        self.assertEqual(detail["photos"], [])
        self.second_user.USER_PROFILE_PICTURE = "https://example.com/avatar.jpg"
        self.second_user.save(update_fields=["USER_PROFILE_PICTURE"])
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/business.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        row = self.client.get(self.list_url, {"ordering": "oldest"}).data["data"]["items"][0]
        self.assertEqual(row["author"]["avatar_url"], self.second_user.USER_PROFILE_PICTURE)
        self.assertEqual(row["business"]["cover_photo_url"], self.business.BUSN_COVER_PHOTO_URL)

    def test_search_by_content(self):
        self.assertEqual(self.ids({"search": "MANGO"}), [self.held.pk])

    def test_search_by_reviewer_names_and_email(self):
        for search in ("Second", "Second Explorer", self.second_user.USER_EMAIL):
            with self.subTest(search=search):
                self.assertEqual(self.ids({"search": search}), [self.review.pk])

    def test_search_by_business(self):
        self.assertEqual(set(self.ids({"search": "Sugbo Bistro"})), {
            review.pk
            for review in self.reviews
        })
        self.assertEqual(self.ids({"search": "No such business"}), [])

    def test_status_filters_include_every_actual_status(self):
        for review in self.reviews:
            with self.subTest(status=review.REVW_STATUS):
                self.assertEqual(self.ids({"status": review.REVW_STATUS}), [review.pk])

    def test_reported_filter_counts_resolved_and_withdrawn_reports(self):
        self.add_report(self.held, "rejected")
        self.add_report(self.flagged, "withdrawn")
        self.assertEqual(set(self.ids({"reported": "true"})), {
            self.review.pk, self.held.pk, self.flagged.pk,
        })
        self.assertEqual(self.ids({"reported": "false"}), [self.rejected.pk])
        self.assertEqual(
            self.ids({"reported": "true", "status": "under_review", "search": "mango"}),
            [self.held.pk],
        )

    def test_date_filters_use_inclusive_manila_days(self):
        Review.objects.filter(pk=self.review.pk).update(
            REVW_CREATED_AT=self.anchor - timedelta(microseconds=1),
        )
        Review.objects.filter(pk=self.held.pk).update(REVW_CREATED_AT=self.anchor)
        Review.objects.filter(pk=self.flagged.pk).update(
            REVW_CREATED_AT=self.anchor + timedelta(days=1) - timedelta(microseconds=1),
        )
        Review.objects.filter(pk=self.rejected.pk).update(
            REVW_CREATED_AT=self.anchor + timedelta(days=1),
        )
        self.assertEqual(set(self.ids({
            "start_date": "2026-10-11",
            "end_date": "2026-10-11",
        })), {self.held.pk, self.flagged.pk})
        self.assertEqual(self.ids({"end_date": "2026-10-10"}), [self.review.pk])
        self.assertEqual(self.ids({"start_date": "2026-10-12"}), [self.rejected.pk])

    def test_newest_oldest_and_stable_ties(self):
        oldest_ids = [review.pk for review in self.reviews]
        self.assertEqual(self.ids(), list(reversed(oldest_ids)))
        self.assertEqual(self.ids({"ordering": "oldest"}), oldest_ids)
        Review.objects.all().update(REVW_CREATED_AT=self.anchor)
        self.assertEqual(self.ids({"ordering": "newest"}), sorted(oldest_ids, reverse=True))
        self.assertEqual(self.ids({"ordering": "oldest"}), sorted(oldest_ids))

    def test_standard_pagination_and_filtered_total(self):
        response = self.client.get(self.list_url, {"page": 2, "page_size": 2})
        data = response.data["data"]
        self.assertEqual(data["pagination"], {
            "page": 2,
            "page_size": 2,
            "total_items": 4,
            "total_pages": 2,
            "has_next": False,
            "has_previous": True,
        })
        self.assertEqual([item["id"] for item in data["items"]], [self.held.pk, self.review.pk])
        response = self.client.get(self.list_url, {"reported": "true", "page_size": 1})
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(self.client.get(self.list_url, {"page": 50}).status_code, 404)

    def test_invalid_filters_return_standard_validation_errors(self):
        for params in (
            {"status": "pending"},
            {"reported": "maybe"},
            {"ordering": "random"},
            {"start_date": "not-a-date"},
            {"start_date": "2026-10-12", "end_date": "2026-10-11"},
            {"end_date": "9999-12-31"},
        ):
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.data["success"])
                self.assertIn("errors", response.data)

    def test_detail_returns_all_photos_reports_and_stored_analysis(self):
        photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/detail.jpg",
            RPHO_PHOTO_PUBLIC_ID="private-media-id",
        )
        report = self.add_report(self.review, "withdrawn")
        Review.objects.filter(pk=self.review.pk).update(
            REVW_MODERATION_DATA={
                "outcome": "safe",
                "checked_at": "2026-10-10T12:00:00Z",
                "raw_provider": "private-ai-internals",
            },
            REVW_INSTALLATION_ID="never-expose-review-device",
            REVW_EDITED_AT=self.anchor,
        )
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["text"], self.review.REVW_TEXT)
        self.assertEqual(data["photos"], [{"id": photo.pk, "photo_url": photo.RPHO_PHOTO_URL}])
        self.assertEqual(data["report_count"], 2)
        self.assertEqual(len(data["reports"]), 2)
        serialized_report = next(item for item in data["reports"] if item["id"] == report.pk)
        self.assertEqual(serialized_report["type"], "other")
        self.assertEqual(serialized_report["status"], "withdrawn")
        self.assertEqual(serialized_report["explanation"], report.RREP_EXPLANATION)
        self.assertEqual(serialized_report["admin_notes"], report.RREP_NOTES)
        self.assertIn("updated_at", serialized_report)
        self.assertIn("withdrawn_at", serialized_report)
        self.assertIn("created_at", serialized_report)
        self.assertNotIn("reporter", serialized_report)
        self.assertEqual(data["sentiment"], {"label": "positive", "score": 0.75})
        self.assertEqual(data["moderation"], {
            "outcome": "safe",
            "checked_at": "2026-10-10T12:00:00Z",
            "provider_unavailable": False,
        })
        self.assertIsNotNone(data["edited_at"])
        self.assertIn("updated_at", data)
        self.assertIn("published_at", data)
        for private_value in (
            "private-ai-internals", "never-expose-report-device",
            "never-expose-review-device", "private-media-id", "Private Reporter",
        ):
            self.assertNotIn(private_value, str(data))

    def test_detail_covers_all_statuses_and_missing_review(self):
        for review in self.reviews:
            response = self.client.get(reverse("admin-all-review-detail", args=[review.pk]))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["status"], review.REVW_STATUS)
        self.assertEqual(
            self.client.get(reverse("admin-all-review-detail", args=[999999])).status_code,
            404,
        )

    def test_missing_and_incomplete_analysis_is_explicit(self):
        url = reverse("admin-all-review-detail", args=[self.held.pk])
        data = self.client.get(url).data["data"]
        self.assertEqual(data["sentiment"], {"label": None, "score": None})
        self.assertEqual(data["moderation"], {
            "outcome": None, "provider_unavailable": False, "checked_at": None,
        })
        Review.objects.filter(pk=self.held.pk).update(
            REVW_MODERATION_DATA={"outcome": "provider_failure", "incomplete": True},
        )
        self.assertTrue(self.client.get(url).data["data"]["moderation"]["provider_unavailable"])

    def test_moderation_links_follow_existing_route_eligibility(self):
        data = self.client.get(self.detail_url).data["data"]
        self.assertEqual(data["moderation_links"], {
            "under_review": None,
            "reported_review": reverse("admin-reported-review-detail", args=[self.review.pk]),
            "review_dispute": None,
        })
        held_url = reverse("admin-all-review-detail", args=[self.held.pk])
        held = self.client.get(held_url).data["data"]
        self.assertEqual(
            held["moderation_links"]["under_review"],
            reverse("admin-under-review-detail", args=[self.held.pk]),
        )
        self.assertIsNone(held["moderation_links"]["reported_review"])
        self.report.RREP_STATUS = "rejected"
        self.report.save(update_fields=["RREP_STATUS"])
        data = self.client.get(self.detail_url).data["data"]
        self.assertIsNone(data["moderation_links"]["reported_review"])

    def test_pending_merchant_dispute_links_to_existing_moderation_case(self):
        dispute = MerchantReviewDispute.objects.create(
            REVW_ID=self.review,
            BUSN_ID=self.business,
            USER_ID=self.user,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
            MRDSP_DESCRIPTION="Existing merchant dispute about the review.",
        )
        data = self.client.get(self.detail_url).data["data"]
        self.assertEqual(
            data["moderation_links"]["review_dispute"],
            reverse("admin-review-dispute-detail", args=[dispute.pk]),
        )
        self.assertEqual(
            self.client.get(data["moderation_links"]["review_dispute"]).status_code,
            200,
        )
        dispute.MRDSP_STATUS = MerchantReviewDispute.DisputeStatus.DISMISSED
        dispute.save(update_fields=["MRDSP_STATUS"])
        data = self.client.get(self.detail_url).data["data"]
        self.assertIsNone(data["moderation_links"]["review_dispute"])

    def test_existing_report_decision_is_visible_and_removes_pending_link(self):
        response = self.client.post(
            reverse("admin-review-report-reject", args=[self.report.pk]),
            {"admin_notes": "Inspected the content and found no violation."},
        )
        self.assertEqual(response.status_code, 200)
        data = self.client.get(self.detail_url).data["data"]
        self.assertEqual(data["status"], "published")
        self.assertEqual(data["report_count"], 1)
        self.assertEqual(data["pending_report_count"], 0)
        self.assertIsNone(data["moderation_links"]["reported_review"])
        self.assertEqual(data["history"][0]["action"], "review_report_rejected")
        self.assertEqual(data["history"][0]["actor"]["id"], self.admin.pk)

    def test_existing_under_review_workflow_and_history_remain_authoritative(self):
        response = self.client.post(
            reverse("admin-under-review-reject", args=[self.held.pk]),
            {"moderation_notes": "Inspected held content and confirmed a violation."},
        )
        self.assertEqual(response.status_code, 200)
        self.held.refresh_from_db()
        self.assertEqual(self.held.REVW_STATUS, "rejected")
        url = reverse("admin-all-review-detail", args=[self.held.pk])
        data = self.client.get(url).data["data"]
        event = data["history"][0]
        self.assertEqual(event["action"], "review_moderation_rejected")
        self.assertEqual(event["previous_review_status"], "under_review")
        self.assertEqual(event["review_status"], "rejected")
        self.assertEqual(event["notes"], "Inspected held content and confirmed a violation.")
        self.assertEqual(self.client.get(data["moderation_links"]["under_review"]).status_code, 200)
        self.assertEqual(self.client.post(
            reverse("admin-under-review-approve", args=[self.held.pk]),
        ).status_code, 400)

    def test_history_uses_only_existing_review_decisions_and_safe_fields(self):
        AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            TARGET_USER_ID=self.second_user,
            AACT_ACTION=AdminActivity.Action.REVIEW_DISPUTE_DISMISSED,
            AACT_CONTEXT={
                "review_id": self.review.pk,
                "previous_review_status": "published",
                "review_status": "published",
                "admin_notes": "The dispute was inspected and dismissed.",
                "snapshot": "private-raw-evidence",
            },
        )
        AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            TARGET_USER_ID=self.second_user,
            AACT_ACTION=AdminActivity.Action.REVIEW_REPORT_REJECTED,
            AACT_CONTEXT={"review_id": self.held.pk},
        )
        data = self.client.get(self.detail_url).data["data"]
        self.assertEqual(len(data["history"]), 1)
        self.assertEqual(data["history"][0]["action"], "review_dispute_dismissed")
        self.assertNotIn("private-raw-evidence", str(data))
        self.assertNotIn("context", data["history"][0])

    def test_directory_endpoints_are_read_only(self):
        before = list(Review.objects.values())
        reports_before = list(ReviewReport.objects.values())
        for url in (self.list_url, self.summary_url, self.detail_url):
            self.assertEqual(self.client.post(url, {"status": "published"}).status_code, 405)
            self.assertEqual(self.client.patch(url, {"status": "rejected"}).status_code, 405)
            self.assertEqual(self.client.delete(url).status_code, 405)
            self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(list(Review.objects.values()), before)
        self.assertEqual(list(ReviewReport.objects.values()), reports_before)
        self.assertEqual(AdminActivity.objects.count(), 0)

    def test_query_counts_do_not_grow_per_row_or_related_record(self):
        for review in self.reviews:
            for index in range(3):
                ReviewPhoto.objects.create(
                    REVW_ID=review,
                    RPHO_PHOTO_URL=f"https://example.com/{index}.jpg",
                    RPHO_PHOTO_PUBLIC_ID=f"photo-{review.pk}-{index}",
                )
            self.add_report(review, "pending")
        with self.assertNumQueries(1):
            summary = AllReviewService.get_summary()
        self.assertEqual(summary["reported"], 4)
        for page_size in (1, 4):
            with self.subTest(page_size=page_size):
                with self.assertNumQueries(1):
                    rows = AdminAllReviewListSerializer(
                        AllReviewService.list_reviews({})[:page_size],
                        many=True,
                    ).data
                self.assertEqual(len(rows), page_size)
        with self.assertNumQueries(4):
            data = AdminAllReviewDetailSerializer(
                AllReviewService.get_review(self.review.pk),
            ).data
        self.assertEqual(len(data["photos"]), 3)
        self.assertEqual(data["report_count"], 2)
