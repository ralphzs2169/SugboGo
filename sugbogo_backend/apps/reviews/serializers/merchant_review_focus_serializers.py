from rest_framework import serializers

from core.pagination import StandardPagination


class MerchantReviewFocusQuerySerializer(serializers.Serializer):
    """Validate a page size shared by review lookup and feed requests."""

    page_size = serializers.IntegerField(
        min_value=1,
        max_value=StandardPagination.max_page_size,
        default=StandardPagination.page_size,
    )
