from math import ceil

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """Provides a standardized paginated API response."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        page_size = self.get_page_size(self.request)

        return Response(
            {
                "success": True,
                "message": "Success.",
                "data": {
                    "items": data,
                    "pagination": {
                        "page": self.page.number,
                        "page_size": page_size,
                        "total_items": self.page.paginator.count,
                        "total_pages": ceil(
                            self.page.paginator.count / page_size
                        ),
                        "has_next": self.page.has_next(),
                        "has_previous": self.page.has_previous(),
                    },
                },
            }
        )