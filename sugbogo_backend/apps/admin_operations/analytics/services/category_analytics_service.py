from datetime import timedelta

from django.utils import timezone
from django.db.models import Count, Q

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

    @staticmethod
    def get_coverage_counts(eligible_ids, visited_ids, *, cluster=None, category=None):
        """Count eligible and visited businesses by current category, retaining empty groups."""
        queryset = Category.objects.all()
        if cluster is not None:
            queryset = queryset.filter(CLUS_ID=cluster)
        if category is not None:
            queryset = queryset.filter(CTGRY_ID=category)
        rows = queryset.annotate(
            eligible=Count("businesses", distinct=True, filter=Q(
                businesses__BUSN_ID__in=eligible_ids,
            )),
            visited=Count("businesses", distinct=True, filter=Q(
                businesses__BUSN_ID__in=visited_ids or [],
            )),
        ).order_by("CTGRY_NAME", "CTGRY_ID")
        return [
            {"id": row.CTGRY_ID, "name": row.CTGRY_NAME, "eligible": row.eligible,
             "visited": row.visited if visited_ids is not None else None}
            for row in rows
        ]
