from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.analytics.services.category_analytics_service import (
    CategoryAnalyticsService,
)
from apps.business.models import Category, Cluster


class CategoryAnalyticsServiceTests(TestCase):
    def setUp(self):
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food-related businesses.",
        )

    def test_category_statistics_returns_total_and_weekly_count(self):
        Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=self.cluster,
        )

        Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=self.cluster,
        )

        result = CategoryAnalyticsService.get_category_statistics()

        self.assertEqual(result["total_categories"], 2)
        self.assertEqual(result["categories_created_this_week"], 2)

    def test_category_statistics_returns_zero_when_no_categories_exist(self):
        result = CategoryAnalyticsService.get_category_statistics()

        self.assertEqual(result["total_categories"], 0)
        self.assertEqual(result["categories_created_this_week"], 0)

    def test_categories_created_this_week_counts_only_current_week(self):
        current_week_category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=self.cluster,
        )

        previous_week_category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=self.cluster,
        )

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_date = current_week_start - timedelta(days=1)

        Category.objects.filter(
            CTGRY_ID=previous_week_category.CTGRY_ID,
        ).update(
            CTGRY_CREATED_AT=timezone.make_aware(
                timezone.datetime.combine(
                    previous_week_date,
                    timezone.datetime.min.time(),
                ),
            ),
        )

        result = CategoryAnalyticsService.get_categories_created_this_week()

        self.assertEqual(result, 1)
        self.assertTrue(
            Category.objects.filter(
                CTGRY_ID=current_week_category.CTGRY_ID,
            ).exists()
        )

    def test_categories_created_this_week_returns_zero_for_previous_week_categories(
        self,
    ):
        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=self.cluster,
        )

        today = timezone.localdate()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_date = current_week_start - timedelta(days=1)

        Category.objects.filter(
            CTGRY_ID=category.CTGRY_ID,
        ).update(
            CTGRY_CREATED_AT=timezone.make_aware(
                timezone.datetime.combine(
                    previous_week_date,
                    timezone.datetime.min.time(),
                ),
            ),
        )

        result = CategoryAnalyticsService.get_categories_created_this_week()

        self.assertEqual(result, 0)