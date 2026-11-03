"""Suspended-business review eligibility and merchant write-boundary regressions."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.test import APITestCase

from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import Business
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from apps.reviews.models import Review, ReviewLike, ReviewReply
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_report_service import ReviewReportService
from apps.users.models import User


class SuspendedBusinessEligibilityTests(DashboardFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.business = self.create_business()
        self.author = self.create_user()
        self.reader = self.create_user()
        self.review = self.create_review(self.business)
        self.stale_business = Business.objects.get(pk=self.business.pk)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")

    def test_early_creation_rejects_without_upload_or_moderation(self):
        with patch("apps.reviews.services.review_service.CloudinaryService.upload_image") as upload:
            with self.assertRaises(NotFound):
                ReviewService.create_review(self.author, self.business.pk, "Review", photos=[object()])
        upload.assert_not_called()
        self.assertEqual(Review.objects.count(), 1)
        self.assertEqual(self.business.BUSN_REVIEW_COUNT, 0)

    def test_public_reads_reject_but_owner_and_author_history_survive(self):
        with self.assertRaises(NotFound):
            ReviewService.get_review_preview(self.business.pk, self.reader)
        with self.assertRaises(NotFound):
            ReviewService.list_reviews_queryset(self.business.pk, self.reader)
        with self.assertRaises(NotFound):
            ReviewService.get_review_detail(self.review.pk, self.reader)
        self.assertEqual(
            ReviewService.get_review_detail(self.review.pk, self.review.USER_ID).pk,
            self.review.pk,
        )
        self.assertEqual(
            ReviewService.get_review_preview(self.business.pk, self.business.USER_ID)["total_count"],
            1,
        )
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)

    def test_likes_replies_and_edits_reject_but_removal_and_reports_survive(self):
        like = ReviewLike.objects.create(REVW_ID=self.review, USER_ID=self.reader)
        with self.assertRaises(NotFound):
            ReviewLikeService.create_like(self.author, self.review.pk)
        with self.assertRaises(NotFound):
            ReviewReplyService.create_reply(self.business.USER_ID, self.review.pk, "Reply")
        with self.assertRaises(NotFound):
            ReviewService.update_review(self.review.USER_ID, self.review.pk, text="Updated")
        ReviewLikeService.remove_like(self.reader, self.review.pk)
        self.assertFalse(ReviewLike.objects.filter(pk=like.pk).exists())
        report = ReviewReportService.create_report(self.reader, self.review.pk, "spam")
        self.assertEqual(report.REVW_ID_id, self.review.pk)
        self.assertFalse(ReviewReply.objects.exists())

    def test_admin_moderation_and_author_removal_remain_available(self):
        from apps.admin_operations.moderation.services.manage_under_review_service import (
            ManageUnderReviewService,
        )
        from apps.admin_operations.system_configuration.models import (
            AnalyticsPolicyConfiguration,
        )
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        held = self.create_review(
            self.business,
            status=Review.ReviewStatus.UNDER_REVIEW,
        )
        admin = self.create_user(role=User.UserRole.ADMIN)
        ManageUnderReviewService.resolve(
            held.pk,
            actor=admin,
            approve=True,
        )
        held.refresh_from_db()
        self.assertEqual(held.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        ReviewService.delete_review(
            held.USER_ID,
            held.pk,
        )
        self.assertFalse(Review.objects.filter(pk=held.pk).exists())

    def test_information_reloads_status_instead_of_trusting_stale_object(self):
        with self.assertRaises(PermissionDenied):
            BusinessProfileService.update_information(self.stale_business, {"BUSN_DESCRIPTION": "Changed"})
        self.business.refresh_from_db()
        self.assertNotEqual(self.business.BUSN_DESCRIPTION, "Changed")
        self.business.USER_ID.refresh_from_db()
        self.assertEqual(self.business.USER_ID.USER_STATUS, User.UserStatus.ACTIVE)

    def test_cover_rejects_before_upload(self):
        with patch("apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.upload_image") as upload:
            with self.assertRaises(PermissionDenied):
                BusinessProfileService.update_cover_photo(self.stale_business, object())
        upload.assert_not_called()

    def test_suspension_during_staged_review_upload_rolls_back_and_cleans_up(self):
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="active")
        def upload(
            *args,
            **kwargs,
        ):
            Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
            return {"public_id": "staged", "secure_url": "https://example.com/staged"}
        with (
            patch("apps.reviews.services.review_service.CloudinaryService.upload_image", side_effect=upload),
            patch("apps.reviews.services.review_service.CloudinaryService.destroy_asset", return_value={"result": "ok"}) as cleanup,
        ):
            with self.assertRaises(NotFound):
                ReviewService.create_review(self.author, self.business.pk, "Review", photos=[object()])
        cleanup.assert_called_once()
        self.assertEqual(Review.objects.count(), 1)

    def test_suspension_during_cover_upload_cleans_up_without_replacement(self):
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="active")
        def upload(
            *args,
            **kwargs,
        ):
            Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
            return {"public_id": "staged", "secure_url": "https://example.com/staged"}
        with (
            patch("apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.upload_image", side_effect=upload),
            patch("apps.merchant_operations.business_profile.services.business_profile_service.CloudinaryService.delete_image") as cleanup,
        ):
            with self.assertRaises(PermissionDenied):
                BusinessProfileService.update_cover_photo(self.stale_business, object())
        cleanup.assert_called_once_with("staged")
        self.business.refresh_from_db()
        self.assertIsNone(self.business.BUSN_COVER_PHOTO_PUBLIC_ID)


class SuspendedBusinessReviewAPITests(DashboardFixtures, APITestCase):
    def test_public_review_reads_and_creation_reject_suspended_business(self):
        business = self.create_business(status="suspended")
        self.create_review(business)
        self.client.force_authenticate(self.create_user())
        for suffix in ("", "all/"):
            response = self.client.get(f"/api/reviews/business/{business.pk}/{suffix}")
            self.assertEqual(response.status_code, 404)
        response = self.client.post(f"/api/reviews/business/{business.pk}/", {"text": "A detailed account of this business visit."})
        self.assertEqual(response.status_code, 404)


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks")
class BusinessEligibilityConcurrencyTests(DashboardFixtures, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.setUpTestData()

    def test_information_waits_for_locked_status_change_and_rejects_after_commit(self):
        business = self.create_business()
        started = Event()
        def edit():
            connections.close_all()
            try:
                def observe(
                    execute,
                    sql,
                    params,
                    many,
                    context,
                ):
                    if "FOR UPDATE" in sql and "BUSINESS" in sql:
                        started.set()
                    return execute(sql, params, many, context)
                with connections["default"].execute_wrapper(observe):
                    return attempt_edit()
            finally:
                connections.close_all()
        def attempt_edit():
            try:
                BusinessProfileService.update_information(
                    business,
                    {"BUSN_DESCRIPTION": "Blocked"},
                )
            except PermissionDenied:
                return "denied"
            return "written"
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                locked = Business.objects.select_for_update().get(pk=business.pk)
                locked.BUSN_STATUS = "suspended"
                locked.save(update_fields=["BUSN_STATUS"])
                future = pool.submit(edit)
                self.assertTrue(started.wait(5))
                self.assertFalse(future.done())
            self.assertEqual(future.result(timeout=10), "denied")
        business.refresh_from_db()
        self.assertNotEqual(business.BUSN_DESCRIPTION, "Blocked")

    def test_review_engagement_waits_for_business_status_commit(self):
        for action in ("review", "like", "reply"):
            with self.subTest(action=action):
                business = self.create_business()
                review = self.create_review(business)
                actor = self.create_user()
                attempting = Event()

                def engage():
                    connections.close_all()
                    def observe(
                        execute,
                        sql,
                        params,
                        many,
                        context,
                    ):
                        if "FOR UPDATE" in sql and "BUSINESS" in sql:
                            attempting.set()
                        return execute(sql, params, many, context)
                    try:
                        with connections["default"].execute_wrapper(observe):
                            try:
                                if action == "review":
                                    ReviewService.create_review(actor, business.pk, "A visit")
                                elif action == "like":
                                    ReviewLikeService.create_like(actor, review.pk)
                                else:
                                    ReviewReplyService.create_reply(business.USER_ID, review.pk, "Thanks")
                            except NotFound:
                                return "denied"
                            return "written"
                    finally:
                        connections.close_all()

                with ThreadPoolExecutor(max_workers=1) as pool:
                    with transaction.atomic():
                        locked = Business.objects.select_for_update().get(pk=business.pk)
                        locked.BUSN_STATUS = "suspended"
                        locked.save(update_fields=["BUSN_STATUS"])
                        future = pool.submit(engage)
                        self.assertTrue(attempting.wait(10))
                        self.assertFalse(future.done())
                    self.assertEqual(future.result(timeout=15), "denied")
                self.assertEqual(Review.objects.filter(BUSN_ID=business).count(), 1)
                self.assertFalse(ReviewLike.objects.filter(REVW_ID=review).exists())
                self.assertFalse(ReviewReply.objects.filter(REVW_ID=review).exists())
