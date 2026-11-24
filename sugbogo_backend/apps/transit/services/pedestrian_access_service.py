"""Evaluate pedestrian access evidence separately from the jeepney centerline."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from django.contrib.gis.geos import Point

from apps.shared.services.google_maps_service import GoogleMapsService, valid_latitude_longitude
from apps.transit.services.coordinate_route_matching_service import RoutePosition, validate_distance

MAXIMUM_ACCESS_OFFSET_METERS = 40.0


class AccessUse(StrEnum):
    """Identify which passenger action the supplied evidence covers."""

    BOARDING = "boarding"
    ALIGHTING = "alighting"


class AccessCoordinateStatus(StrEnum):
    """Differentiate usable input coordinates from independently verified access."""

    PROVISIONAL = "provisional"
    VERIFIED = "verified"
    INVALID = "invalid"


class AccessPermission(StrEnum):
    """Record independent operational or legal permission for this action."""

    UNKNOWN = "unknown"
    PERMITTED = "permitted"
    PROHIBITED = "prohibited"


AccessLocationKey = tuple[int, float, AccessUse]


@dataclass(frozen=True)
class AccessLocationEvidence:
    """Caller-supplied evidence for an action on the current directional geometry."""

    point: Point | None = None
    coordinate_verified: bool = False
    permission: AccessPermission = AccessPermission.UNKNOWN


@dataclass(frozen=True)
class PedestrianAccessLocation:
    """Retain the route measure and the independently evaluated pedestrian coordinate."""

    route_position: RoutePosition
    point: Point | None
    coordinate_status: AccessCoordinateStatus
    permission: AccessPermission

    @property
    def passenger_location_verified(self) -> bool:
        """Require both independently verified access and permission to use it."""
        return (
            self.coordinate_status is AccessCoordinateStatus.VERIFIED
            and self.permission is AccessPermission.PERMITTED
        )


def access_location_key(
    variant_id: int,
    position: RoutePosition,
    use: AccessUse,
) -> AccessLocationKey:
    """Identify the role and occurrence of an access position on a variant."""
    return variant_id, round(position.fraction, 12), use


def valid_pedestrian_point(point: Point | None) -> bool:
    """Check that a pedestrian point is a two-dimensional WGS84 location."""
    return (
        isinstance(point, Point)
        and not point.empty
        and point.srid == 4326
        and not point.hasz
        and valid_latitude_longitude(point.y, point.x)
    )


class PedestrianAccessService:
    """Resolve optionally verified input points without manufacturing curb coordinates."""

    @staticmethod
    def evaluate(
        *,
        variant_id: int,
        position: RoutePosition,
        use: AccessUse,
        evidence: Mapping[AccessLocationKey, AccessLocationEvidence],
        maximum_offset_meters: float = MAXIMUM_ACCESS_OFFSET_METERS,
    ) -> PedestrianAccessLocation:
        """Validate supplied access coordinates or keep the route point provisional."""
        validate_distance("maximum_offset_meters", maximum_offset_meters)
        record = evidence.get(access_location_key(variant_id, position, use), AccessLocationEvidence())
        permission = record.permission
        if not isinstance(permission, AccessPermission):
            permission = AccessPermission.UNKNOWN
        point = record.point if record.point is not None else position.point
        if (
            not valid_pedestrian_point(point)
            or not valid_pedestrian_point(position.point)
            or GoogleMapsService.calculate_distance_meters(
                position.point.y,
                position.point.x,
                point.y,
                point.x,
            ) > maximum_offset_meters
        ):
            return PedestrianAccessLocation(
                route_position=position,
                point=None,
                coordinate_status=AccessCoordinateStatus.INVALID,
                permission=permission,
            )

        status = AccessCoordinateStatus.PROVISIONAL
        if record.point is not None and record.coordinate_verified is True:
            status = AccessCoordinateStatus.VERIFIED
        return PedestrianAccessLocation(
            route_position=position,
            point=point,
            coordinate_status=status,
            permission=permission,
        )
