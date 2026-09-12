from unittest.mock import patch

from apps.business.models import Business
from apps.explorer_operations.explore_businesses.services.explore_map_preview_service import (
    MAP_PREVIEW_LIMIT,
    MAP_PREVIEW_RADIUS_KM,
    ExploreMapPreviewService,
)
from django.test import SimpleTestCase


class ExploreMapPreviewServiceTests(SimpleTestCase):
    """Tests nearby business selection for the Explorer map preview."""

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.D",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Distance",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Point",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Business.objects",
    )
    def test_queries_active_businesses_within_preview_radius(
        self,
        mock_objects,
        mock_point,
        mock_distance,
        mock_d,
    ):
        queryset = mock_objects.select_related.return_value
        filtered_queryset = queryset.filter.return_value
        annotated_queryset = filtered_queryset.annotate.return_value
        ordered_queryset = annotated_queryset.order_by.return_value

        expected_businesses = [
            object(),
            object(),
        ]

        ordered_queryset.__getitem__.return_value = expected_businesses

        result = ExploreMapPreviewService.list_nearby_preview_businesses(
            latitude="10.3157",
            longitude="123.8854",
        )

        mock_point.assert_called_once_with(
            123.8854,
            10.3157,
            srid=4326,
        )

        mock_objects.select_related.assert_called_once_with(
            "CTGRY_ID",
            "CTGRY_ID__CLUS_ID",
            "LOCT_ID",
        )

        mock_d.assert_called_once_with(
            km=MAP_PREVIEW_RADIUS_KM,
        )

        queryset.filter.assert_called_once_with(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            LOCT_ID__LOCT_POINT__distance_lte=(
                mock_point.return_value,
                mock_d.return_value,
            ),
        )

        self.assertEqual(
            result,
            expected_businesses,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.D",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Distance",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Point",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Business.objects",
    )
    def test_orders_nearby_businesses_by_distance(
        self,
        mock_objects,
        mock_point,
        mock_distance,
        mock_d,
    ):
        queryset = mock_objects.select_related.return_value
        filtered_queryset = queryset.filter.return_value
        annotated_queryset = filtered_queryset.annotate.return_value
        ordered_queryset = annotated_queryset.order_by.return_value

        ordered_queryset.__getitem__.return_value = []

        ExploreMapPreviewService.list_nearby_preview_businesses(
            latitude=10.3157,
            longitude=123.8854,
        )

        mock_distance.assert_called_once_with(
            "LOCT_ID__LOCT_POINT",
            mock_point.return_value,
        )

        filtered_queryset.annotate.assert_called_once_with(
            distance=mock_distance.return_value,
        )

        annotated_queryset.order_by.assert_called_once_with(
            "distance",
            "BUSN_ID",
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.D",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Distance",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Point",
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "business_map_service.Business.objects",
    )
    def test_limits_results_to_map_preview_limit(
        self,
        mock_objects,
        mock_point,
        mock_distance,
        mock_d,
    ):
        queryset = mock_objects.select_related.return_value
        filtered_queryset = queryset.filter.return_value
        annotated_queryset = filtered_queryset.annotate.return_value
        ordered_queryset = annotated_queryset.order_by.return_value

        ordered_queryset.__getitem__.return_value = []

        ExploreMapPreviewService.list_nearby_preview_businesses(
            latitude=10.3157,
            longitude=123.8854,
        )

        ordered_queryset.__getitem__.assert_called_once_with(
            slice(
                None,
                MAP_PREVIEW_LIMIT,
                None,
            ),
        )