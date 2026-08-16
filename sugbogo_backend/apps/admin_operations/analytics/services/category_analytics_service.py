from datetime import timedelta

from django.utils import timezone

from apps.business.models import Category


class CategoryAnalyticsService:
    """Provides analytics and metrics for business categories."""

    @staticmethod
    def get_category_statistics():
        """Retrieve aggregate category management statistics."""

        return {
            "total_categories": Category.objects.count(),
            "categories_created_this_week": (
                CategoryAnalyticsService
                .get_categories_created_this_week()
            ),
        }

    @staticmethod
    def get_categories_created_this_week():
        """Return the number of categories created during the current week."""

        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())

        return Category.objects.filter(
            CTGRY_CREATED_AT__date__gte=week_start,
            CTGRY_CREATED_AT__date__lte=today,
        ).count()