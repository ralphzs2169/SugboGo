from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.reviews.models import BusinessReviewSummary
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User


class AdminReviewInsightsViewsTests(SummaryFixtureMixin, APITestCase):
    def setUp(self):
        self.business = self.create_business()
        self.admin = self.create_user("admin", User.UserRole.ADMIN)
        self.super_admin = self.create_user(
            "super-admin",
            User.UserRole.SUPER_ADMIN,
        )
        self.explorer = self.create_user("explorer", User.UserRole.EXPLORER)
        self.detail_url = f"/api/admin/businesses/{self.business.pk}/"
        self.refresh_url = (
            f"/api/admin/businesses/{self.business.pk}/review-insights/refresh/"
        )

    @staticmethod
    def create_user(name, role):
        return User.objects.create_user(
            email=f"insights-{name}@example.com",
            password=None,
            USER_FNAME="Review",
            USER_LNAME="Insights",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def test_admin_and_super_admin_queue_refresh_without_inline_processing(self):
        for user in (self.admin, self.super_admin):
            with self.subTest(role=user.USER_ROLE):
                self.client.force_authenticate(user)
                with (
                    patch(
                        "apps.admin_operations.business_management.views.manage_business_views.refresh_business_review_insights.delay",
                    ) as enqueue,
                    patch(
                        "apps.reviews.services.business_review_insights_service.BusinessReviewInsightsService.refresh",
                    ) as process,
                ):
                    response = self.client.post(self.refresh_url)

                self.assertEqual(response.status_code, 202)
                self.assertEqual(response.data, {
                    "success": True,
                    "message": "Review insights refresh has been queued.",
                    "data": {"business_id": self.business.pk},
                })
                enqueue.assert_called_once_with(self.business.pk)
                process.assert_not_called()

    def test_explorer_cannot_queue_refresh(self):
        self.client.force_authenticate(self.explorer)

        with patch(
            "apps.admin_operations.business_management.views.manage_business_views.refresh_business_review_insights.delay",
        ) as enqueue:
            response = self.client.post(self.refresh_url)

        self.assertEqual(response.status_code, 403)
        enqueue.assert_not_called()

    def test_missing_business_returns_controlled_not_found_without_enqueuing(self):
        self.client.force_authenticate(self.admin)

        with patch(
            "apps.admin_operations.business_management.views.manage_business_views.refresh_business_review_insights.delay",
        ) as enqueue:
            response = self.client.post(
                "/api/admin/businesses/999999/review-insights/refresh/",
            )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["message"], "The business could not be found.")
        enqueue.assert_not_called()

    def test_detail_exposes_stored_insights_with_separate_timestamps(self):
        computed_at = timezone.now()
        processed_at = computed_at - timedelta(days=1)
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_REVIEW_COUNT=5,
            BRSU_CLASSIFIED_REVIEW_COUNT=4,
            BRSU_POSITIVE_COUNT=2,
            BRSU_NEUTRAL_COUNT=1,
            BRSU_NEGATIVE_COUNT=1,
            BRSU_KEYWORD_TAGS=[{"text": "friendly service", "count": 3}],
            BRSU_SENTIMENT_COMPUTED_AT=computed_at,
            BRSU_KEYWORDS_PROCESSED_AT=processed_at,
            BRSU_KEYWORDS_FINGERPRINT="private",
            BRSU_KEYWORDS_RETRYABLE=True,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(self.detail_url)

        self.assertEqual(response.status_code, 200)
        insights = response.data["data"]["review_insights"]
        self.assertEqual(set(insights), {
            "review_count",
            "sentiment",
            "frequent_mentions",
            "sentiment_computed_at",
            "keywords_processed_at",
        })
        self.assertEqual(insights["review_count"], 5)
        self.assertEqual(insights["sentiment"], {
            "positive": {"count": 2, "percentage": 50.0},
            "neutral": {"count": 1, "percentage": 25.0},
            "negative": {"count": 1, "percentage": 25.0},
        })
        self.assertEqual(
            insights["frequent_mentions"],
            [{"label": "friendly service", "count": 3}],
        )
        self.assertEqual(
            insights["sentiment_computed_at"],
            computed_at.isoformat().replace("+00:00", "Z"),
        )
        self.assertEqual(
            insights["keywords_processed_at"],
            processed_at.isoformat().replace("+00:00", "Z"),
        )

    def test_detail_has_null_insights_when_summary_is_missing(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(self.detail_url)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"]["review_insights"])

    def test_detail_eager_loads_present_and_missing_summary(self):
        for summary_exists in (False, True):
            with self.subTest(summary_exists=summary_exists):
                if summary_exists:
                    BusinessReviewSummary.objects.create(BUSN_ID=self.business)

                business = BusinessService.get_business_detail(self.business.pk)

                with self.assertNumQueries(0):
                    self.assertEqual(
                        getattr(business, "review_summary", None) is not None,
                        summary_exists,
                    )
