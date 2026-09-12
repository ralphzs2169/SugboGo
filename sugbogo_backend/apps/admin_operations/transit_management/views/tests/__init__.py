from apps.admin_operations.transit_management.services.jeepney_route_service import (
    JeepneyRouteService,
)
from apps.admin_operations.transit_management.services.route_variant_service import (
    RouteVariantService,
)
from apps.admin_operations.transit_management.services.transit_point_service import (
    TransitPointService,
)
from apps.users.models import User


class TransitManagementViewTestMixin:
    """Provide shared authenticated transit-management API fixtures."""

    def setUp(self):
        """Create an administrator and reusable transit network records."""

        self.admin = User.objects.create_user(
            email="transit-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Transit",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.merchant = User.objects.create_user(
            email="transit-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Transit",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            self.admin,
        )

        self.kamputhaw = self._create_point(
            "Kamputhaw",
            123.8930,
            10.3150,
        )
        self.capitol = self._create_point(
            "Capitol",
            123.8908,
            10.3173,
        )
        self.colon = self._create_point(
            "Colon",
            123.9003,
            10.2940,
        )
        self.carbon = self._create_point(
            "Carbon",
            123.8991,
            10.2910,
        )

        self.route_14d = JeepneyRouteService.create_route(
            {
                "code": "14D",
            },
        )
        self.route_08g = JeepneyRouteService.create_route(
            {
                "code": "08G",
            },
        )

        self.variant_14d = self._create_variant(
            self.route_14d,
            self.kamputhaw,
            self.colon,
            [
                self.kamputhaw,
                self.capitol,
                self.colon,
            ],
        )
        self.variant_08g = self._create_variant(
            self.route_08g,
            self.carbon,
            self.colon,
            [
                self.carbon,
                self.colon,
            ],
        )

    def _create_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create a Transit Point fixture."""

        return TransitPointService.create_transit_point(
            {
                "name": name,
                "longitude": longitude,
                "latitude": latitude,
            },
        )

    def _create_variant(
        self,
        route,
        origin,
        destination,
        transit_points,
    ):
        """Create a coherent route variant fixture."""

        return RouteVariantService.create_variant(
            {
                "JRT_ID": route,
                "JRV_ORIGIN_ID": origin,
                "JRV_DESTINATION_ID": destination,
                "geometry": [
                    {
                        "longitude": origin.TRPT_POINT.x,
                        "latitude": origin.TRPT_POINT.y,
                    },
                    {
                        "longitude": destination.TRPT_POINT.x,
                        "latitude": destination.TRPT_POINT.y,
                    },
                ],
                "ordered_transit_points": transit_points,
            },
        )

    def _variant_payload(
        self,
        route,
        origin,
        destination,
        transit_points,
    ):
        """Build a frontend route-variant payload."""

        return {
            "route_id": route.JRT_ID,
            "origin_transit_point_id": origin.TRPT_ID,
            "destination_transit_point_id": destination.TRPT_ID,
            "geometry": [
                {
                    "longitude": origin.TRPT_POINT.x,
                    "latitude": origin.TRPT_POINT.y,
                },
                {
                    "longitude": destination.TRPT_POINT.x,
                    "latitude": destination.TRPT_POINT.y,
                },
            ],
            "transit_point_ids": [
                transit_point.TRPT_ID
                for transit_point in transit_points
            ],
        }

    def _transfer_payload(self):
        """Build a valid frontend transfer payload."""

        return {
            "source_variant_id": self.variant_14d.JRV_ID,
            "destination_variant_id": self.variant_08g.JRV_ID,
            "alighting_transit_point_id": self.colon.TRPT_ID,
            "boarding_transit_point_id": self.carbon.TRPT_ID,
        }

