"""Construct bounded jeepney itineraries from directed centerline positions."""

import math
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from heapq import nsmallest

from django.contrib.gis.geos import LineString, Point
from rest_framework.exceptions import ValidationError

from apps.transit.constants import DIRECT_ROUTE_SEARCH_RADIUS_METERS
from apps.transit.services.coordinate_route_matching_service import (
    MINIMUM_COORDINATE_RIDE_DISTANCE_METERS,
    CoordinateRouteMatchingService,
    RideKey,
    RouteEndpointPosition,
    RoutePosition,
    valid_route_geometries,
    validate_distance,
)
from apps.transit.services.route_connection_service import (
    MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS,
    RouteConnection,
    RouteConnectionService,
    TransferValidationStatus,
)

MAXIMUM_SUPPORTED_TRANSFERS = 2


@dataclass(frozen=True)
class CoordinateJourneySearchLimits:
    """Bound search work and score experimental itineraries in distance units."""

    max_transfers: int = MAXIMUM_SUPPORTED_TRANSFERS
    maximum_access_distance_meters: float = DIRECT_ROUTE_SEARCH_RADIUS_METERS
    maximum_egress_distance_meters: float = DIRECT_ROUTE_SEARCH_RADIUS_METERS
    maximum_provisional_transfer_distance_meters: float = MAXIMUM_PROVISIONAL_TRANSFER_DISTANCE_METERS
    minimum_ride_distance_meters: float = MINIMUM_COORDINATE_RIDE_DISTANCE_METERS
    transfer_penalty_meters: float = 100.0
    maximum_journeys: int = 20
    maximum_search_work: int = 20_000

    def validate(self):
        """Check the configured depth, candidate limits, and distance weights."""
        if (
            type(self.max_transfers) is not int
            or not 0 <= self.max_transfers <= MAXIMUM_SUPPORTED_TRANSFERS
        ):
            raise ValidationError({
                "max_transfers": f"Provide an integer from 0 to {MAXIMUM_SUPPORTED_TRANSFERS}.",
            })
        for field, limit in (
            ("maximum_journeys", self.maximum_journeys),
            ("maximum_search_work", self.maximum_search_work),
        ):
            if type(limit) is not int or limit < 1:
                raise ValidationError({field: "Provide a positive integer."})
        for field, distance in (
            ("maximum_access_distance_meters", self.maximum_access_distance_meters),
            ("maximum_egress_distance_meters", self.maximum_egress_distance_meters),
            (
                "maximum_provisional_transfer_distance_meters",
                self.maximum_provisional_transfer_distance_meters,
            ),
            ("minimum_ride_distance_meters", self.minimum_ride_distance_meters),
        ):
            validate_distance(field, distance)
        if (
            not math.isfinite(self.transfer_penalty_meters)
            or self.transfer_penalty_meters < 0
        ):
            raise ValidationError({"transfer_penalty_meters": "Provide a finite, nonnegative penalty."})


@dataclass(frozen=True)
class CoordinateRideLeg:
    """A measured jeepney ride with geometric boarding and alighting positions."""

    variant_id: int
    jeepney_route_code: str
    boarding_position: RoutePosition
    alighting_position: RoutePosition
    ride_geometry: LineString
    ride_distance_meters: float


@dataclass(frozen=True)
class CoordinateJeepneyJourney:
    """An internal itinerary whose access and transfer distances are straight-line estimates."""

    ride_legs: tuple[CoordinateRideLeg, ...]
    transfers: tuple[RouteConnection, ...]
    access_distance_meters: float
    transfer_distance_meters: float
    egress_distance_meters: float
    approximate_total_walking_distance_meters: float
    total_ride_distance_meters: float
    transfer_penalty_meters: float
    ranking_cost_meters: float

    @property
    def transfer_count(self) -> int:
        """Count transitions between consecutive ride legs."""
        return len(self.transfers)

    @property
    def has_provisional_transfers(self) -> bool:
        """Indicate whether the itinerary includes any unchecked pedestrian connections."""
        return any(
            transfer.validation_status is TransferValidationStatus.PROVISIONAL
            for transfer in self.transfers
        )


@dataclass(frozen=True)
class _RideRequest:
    """A pair of ordered positions awaiting a shared PostGIS ride measurement."""

    variant_id: int
    boarding: RoutePosition
    alighting: RoutePosition

    @property
    def key(self) -> RideKey:
        """Identify a ride by variant and fractions on the supplied geometry."""
        return (self.variant_id, self.boarding.fraction, self.alighting.fraction)


@dataclass(frozen=True)
class _SearchState:
    """Track previously completed rides and the current boarding position."""

    variant_id: int
    boarding: RoutePosition
    access_distance_meters: float
    rides: tuple[_RideRequest, ...] = ()
    transfers: tuple[RouteConnection, ...] = ()


@dataclass(frozen=True)
class _JourneyRequest:
    """A complete itinerary to measure and rank."""

    rides: tuple[_RideRequest, ...]
    transfers: tuple[RouteConnection, ...]
    access_distance_meters: float
    egress_distance_meters: float


def _position_matches_geometry(
    position: RoutePosition,
    geometry: LineString,
) -> bool:
    """Discard supplied positions that disagree with their current line and fraction."""
    if (
        not 0 <= position.fraction <= 1
        or not isinstance(position.point, Point)
        or position.point.srid != 4326
        or position.point.empty
        or position.point.hasz
    ):
        return False
    expected = geometry.interpolate_normalized(position.fraction)
    return expected.equals_exact(position.point, tolerance=1e-8)


def _eligible_connections(
    *,
    candidates: Iterable[RouteConnection],
    routes: Mapping[int, LineString],
    route_codes: Mapping[int, str],
    limits: CoordinateJourneySearchLimits,
    allow_provisional_transfers: bool,
) -> dict[int, list[RouteConnection]]:
    """Resolve duplicate evidence and index usable directed connections by source."""
    status_priority = {
        TransferValidationStatus.PROVISIONAL: 0,
        TransferValidationStatus.PEDESTRIAN_VALIDATED: 1,
        TransferValidationStatus.NON_WALKABLE: 2,
    }
    unique = {}
    for candidate in candidates:
        source = candidate.from_variant_id
        target = candidate.to_variant_id
        distance = candidate.straight_line_distance_meters
        if (
            source not in routes
            or target not in routes
            or route_codes[source] == route_codes[target]
            or routes[source].equals_exact(routes[target])
            or not isinstance(candidate.validation_status, TransferValidationStatus)
            or not math.isfinite(distance)
            or distance < 0
            or not 0 < candidate.alighting_position.fraction <= 1
            or not 0 <= candidate.boarding_position.fraction < 1
            or not _position_matches_geometry(candidate.alighting_position, routes[source])
            or not _position_matches_geometry(candidate.boarding_position, routes[target])
        ):
            continue

        key = (
            source,
            target,
            round(candidate.alighting_position.fraction, 12),
            round(candidate.boarding_position.fraction, 12),
        )
        # Blocked evidence wins even if the same connection also carries provisional or approved evidence.
        candidate_order = (
            -status_priority[candidate.validation_status],
            distance,
            candidate.alighting_position.fraction,
            candidate.boarding_position.fraction,
        )
        if key not in unique or candidate_order < unique[key][0]:
            unique[key] = (candidate_order, candidate)

    outgoing = defaultdict(list)
    for key in sorted(unique):
        candidate = unique[key][1]
        if candidate.validation_status is TransferValidationStatus.NON_WALKABLE:
            continue
        if (
            candidate.validation_status is TransferValidationStatus.PROVISIONAL
            and (
                not allow_provisional_transfers
                or candidate.straight_line_distance_meters > limits.maximum_provisional_transfer_distance_meters
            )
        ):
            continue
        outgoing[candidate.from_variant_id].append(candidate)
    return outgoing


def _journey_requests(
    *,
    positions: Iterable[RouteEndpointPosition],
    outgoing: Mapping[int, list[RouteConnection]],
    route_codes: Mapping[int, str],
    limits: CoordinateJourneySearchLimits,
) -> Iterator[_JourneyRequest]:
    """Explore directionally ordered paths and prune variants that cannot reach the destination."""
    pending = []
    destinations = defaultdict(list)
    for position in positions:
        if position.is_boarding:
            pending.append(_SearchState(
                variant_id=position.variant_id,
                boarding=position.position,
                access_distance_meters=position.distance_meters,
            ))
        else:
            destinations[position.variant_id].append(position)

    # This bound ignores measures and visited routes, so it can only prune dead ends.
    reachable = [set(destinations)]
    for _ in range(limits.max_transfers):
        previous = reachable[-1]
        reachable.append(previous | {
            source
            for source, links in outgoing.items()
            if any(link.to_variant_id in previous for link in links)
        })

    explored = len(pending)
    while pending:
        state = pending.pop()
        remaining = limits.max_transfers - len(state.transfers)
        if state.variant_id not in reachable[remaining]:
            continue

        destination_options = destinations.get(state.variant_id, ())
        links = outgoing.get(state.variant_id, ()) if remaining else ()
        explored += len(destination_options) + len(links)
        if explored > limits.maximum_search_work:
            raise ValidationError({"search": "The itinerary search exceeded its candidate budget."})

        for destination in destination_options:
            if state.boarding.fraction < destination.position.fraction:
                ride = _RideRequest(
                    variant_id=state.variant_id,
                    boarding=state.boarding,
                    alighting=destination.position,
                )
                yield _JourneyRequest(
                    rides=(*state.rides, ride),
                    transfers=state.transfers,
                    access_distance_meters=state.access_distance_meters,
                    egress_distance_meters=destination.distance_meters,
                )

        visited_codes = {
            route_codes[ride.variant_id]
            for ride in state.rides
        }
        visited_codes.add(route_codes[state.variant_id])
        for link in links:
            if (
                link.to_variant_id not in reachable[remaining - 1]
                or route_codes[link.to_variant_id] in visited_codes
                or state.boarding.fraction >= link.alighting_position.fraction
            ):
                continue
            ride = _RideRequest(
                variant_id=state.variant_id,
                boarding=state.boarding,
                alighting=link.alighting_position,
            )
            pending.append(_SearchState(
                variant_id=link.to_variant_id,
                boarding=link.boarding_position,
                access_distance_meters=state.access_distance_meters,
                rides=(*state.rides, ride),
                transfers=(*state.transfers, link),
            ))


def _measured_journeys(
    *,
    requests: Iterable[_JourneyRequest],
    measurements: Mapping[RideKey, tuple[LineString, float]],
    route_codes: Mapping[int, str],
    transfer_penalty_meters: float,
) -> Iterator[CoordinateJeepneyJourney]:
    """Assemble only complete itineraries whose rides passed the minimum distance."""
    for request in requests:
        if any(ride.key not in measurements for ride in request.rides):
            continue
        legs = tuple(
            CoordinateRideLeg(
                variant_id=ride.variant_id,
                jeepney_route_code=route_codes[ride.variant_id],
                boarding_position=ride.boarding,
                alighting_position=ride.alighting,
                ride_geometry=measurements[ride.key][0],
                ride_distance_meters=measurements[ride.key][1],
            )
            for ride in request.rides
        )
        transfer_distance = sum(
            transfer.straight_line_distance_meters
            for transfer in request.transfers
        )
        walking_distance = (
            request.access_distance_meters
            + transfer_distance
            + request.egress_distance_meters
        )
        transfer_penalty = transfer_penalty_meters * len(request.transfers)
        yield CoordinateJeepneyJourney(
            ride_legs=legs,
            transfers=request.transfers,
            access_distance_meters=request.access_distance_meters,
            transfer_distance_meters=transfer_distance,
            egress_distance_meters=request.egress_distance_meters,
            approximate_total_walking_distance_meters=walking_distance,
            total_ride_distance_meters=sum(leg.ride_distance_meters for leg in legs),
            transfer_penalty_meters=transfer_penalty,
            ranking_cost_meters=walking_distance + transfer_penalty,
        )


def coordinate_journey_rank(
    journey: CoordinateJeepneyJourney,
    *,
    ranking_cost_meters: float | None = None,
):
    """Order complete candidates by penalized access cost, ride meters, and positional identity."""
    return (
        journey.ranking_cost_meters if ranking_cost_meters is None else ranking_cost_meters,
        journey.total_ride_distance_meters,
        tuple(
            (leg.variant_id, leg.boarding_position.fraction, leg.alighting_position.fraction)
            for leg in journey.ride_legs
        ),
    )


class CoordinateJourneyService:
    """Search eligible directional routes without treating centerline positions as stops."""

    @staticmethod
    def search(
        *,
        origin: Point,
        destination: Point,
        route_geometries: Mapping[int, LineString],
        route_codes: Mapping[int, str],
        connections: Iterable[RouteConnection] | None = None,
        allow_provisional_transfers: bool = False,
        limits: CoordinateJourneySearchLimits = CoordinateJourneySearchLimits(),
    ) -> list[CoordinateJeepneyJourney]:
        """Rank up to three rides, requiring pedestrian evidence by default for any transfer."""
        limits.validate()
        routes = valid_route_geometries(route_geometries)
        if any(not route_codes.get(variant_id) for variant_id in routes):
            raise ValidationError({"route_codes": "Provide a route code for each eligible variant."})
        positions = CoordinateRouteMatchingService.find_endpoint_positions(
            origin=origin,
            destination=destination,
            route_geometries=routes,
            maximum_access_distance_meters=limits.maximum_access_distance_meters,
            maximum_egress_distance_meters=limits.maximum_egress_distance_meters,
        )
        if (
            not any(position.is_boarding for position in positions)
            or not any(not position.is_boarding for position in positions)
        ):
            return []

        if limits.max_transfers and connections is None and allow_provisional_transfers:
            connections = RouteConnectionService.discover(
                route_geometries=routes,
                maximum_transfer_distance_meters=limits.maximum_provisional_transfer_distance_meters,
            )

        outgoing = {}
        if limits.max_transfers and connections is not None:
            outgoing = _eligible_connections(
                candidates=connections,
                routes=routes,
                route_codes=route_codes,
                limits=limits,
                allow_provisional_transfers=allow_provisional_transfers,
            )

        requests = list(_journey_requests(
            positions=positions,
            outgoing=outgoing,
            route_codes=route_codes,
            limits=limits,
        ))
        measurements = CoordinateRouteMatchingService.measure_rides(
            route_geometries=routes,
            rides={
                ride.key
                for request in requests
                for ride in request.rides
            },
            minimum_ride_distance_meters=limits.minimum_ride_distance_meters,
        )
        return nsmallest(
            limits.maximum_journeys,
            _measured_journeys(
                requests=requests,
                measurements=measurements,
                route_codes=route_codes,
                transfer_penalty_meters=limits.transfer_penalty_meters,
            ),
            key=coordinate_journey_rank,
        )
