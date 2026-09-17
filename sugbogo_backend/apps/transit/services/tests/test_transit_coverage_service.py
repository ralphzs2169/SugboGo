from django.test import SimpleTestCase, override_settings

from apps.transit.services.transit_coverage_service import (
    TransitCoverageService,
)


class TransitCoverageServiceTests(SimpleTestCase):
    """Tests the configured Metro Cebu origin-search restriction."""

    def test_autocomplete_restriction_uses_metro_cebu_mvp_configuration(self):
        result = (
            TransitCoverageService.get_autocomplete_location_restriction()
        )

        self.assertEqual(
            result,
            {
                "rectangle": {
                    "low": {
                        "latitude": 10.20,
                        "longitude": 123.75,
                    },
                    "high": {
                        "latitude": 10.50,
                        "longitude": 124.05,
                    },
                },
            },
        )

    @override_settings(
        JOURNEY_ORIGIN_SEARCH_AREA={
            "name": "Expanded future scope",
            "southwest": {
                "latitude": 10.00,
                "longitude": 123.50,
            },
            "northeast": {
                "latitude": 10.75,
                "longitude": 124.25,
            },
        }
    )
    def test_autocomplete_restriction_can_expand_through_configuration(self):
        self.assertEqual(
            TransitCoverageService.get_autocomplete_location_restriction(),
            {
                "rectangle": {
                    "low": {
                        "latitude": 10.00,
                        "longitude": 123.50,
                    },
                    "high": {
                        "latitude": 10.75,
                        "longitude": 124.25,
                    },
                },
            },
        )
