from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce

from apps.reviews.models import Review


def published_review_count():
    """Counts all currently published reviews without limiting the insights window."""
    counts = (
        Review.objects.filter(
            BUSN_ID_id=OuterRef("BUSN_ID"),
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        .order_by()
        .values("BUSN_ID_id")
        .annotate(total=Count("REVW_ID"))
        .values("total")[:1]
    )
    return Coalesce(
        Subquery(counts, output_field=IntegerField()),
        Value(0),
    )
