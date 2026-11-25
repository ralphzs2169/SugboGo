"""Construct bounded jeepney itineraries from directed centerline positions."""

import math
from bisect import bisect_right
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass, field, replace
from functools import cache
from heapq import nsmallest
from itertools import batched

from django.contrib.gis.geos import LineString, Point
from django.db import OperationalError, transaction
from rest_framework.exceptions import ValidationError

from apps.transit.constants import DIRECT_ROUTE_SEARCH_RADIUS_METERS
from apps.transit.services.coordinate_ride_measurement_service import (
    RIDE_MEASUREMENT_BATCH_SIZE,
    measure_journey_rides,
)
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
    RouteConnectionBudgetExceeded,
    RouteConnectionDiscoveryProgress,
    RouteConnectionService,
    TransferValidationStatus,
)

MAXIMUM_SUPPORTED_TRANSFERS = 2


@dataclass
class CoordinateJourneySearchProgress:
    """Record viable expansion by depth and whether the search stopped early."""

    incomplete_reason: str | None = None
    nearby_origin_variants: int = 0
    nearby_destination_variants: int = 0
    destination_options: dict[int, int] = field(default_factory=lambda: defaultdict(int))
    transfer_options: dict[int, int] = field(default_factory=lambda: defaultdict(int))
    suffix_links_checked: int = 0
    connection_discovery: RouteConnectionDiscoveryProgress = field(
        default_factory=RouteConnectionDiscoveryProgress,
    )
    ride_measurement_cancelled: bool = False


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
    progress: CoordinateJourneySearchProgress,
    minimum_transfers: int = 0,
) -> Iterator[_JourneyRequest]:
    """Explore only paths with a directionally reachable suffix."""
    origins = []
    destinations = defaultdict(list)
    for position in positions:
        if position.is_boarding:
            origins.append(_SearchState(
                variant_id=position.variant_id,
                boarding=position.position,
                access_distance_meters=position.distance_meters,
            ))
        else:
            destinations[position.variant_id].append(position)

    for options in destinations.values():
        options.sort(key=lambda endpoint: endpoint.position.fraction)
    destination_fractions = {
        variant_id: tuple(option.position.fraction for option in options)
        for variant_id, options in destinations.items()
    }

    @cache
    def suffix_options(variant_id, remaining, visited_codes):
        # The latest possible alighting fraction bounds every feasible boarding.
        # The bound ignores minimum distance, which is checked on the sliced rides.
        if remaining == 0:
            return destination_fractions.get(variant_id, ()), ()
        links = []
        for link in outgoing.get(variant_id, ()):
            progress.suffix_links_checked += 1
            target_code = route_codes[link.to_variant_id]
            if target_code in visited_codes:
                continue
            fractions, _ = suffix_options(
                link.to_variant_id,
                remaining - 1,
                visited_codes | {target_code},
            )
            if (
                fractions
                and link.boarding_position.fraction < fractions[-1]
            ):
                links.append(link)
        links.sort(key=lambda link: link.alighting_position.fraction)
        return tuple(link.alighting_position.fraction for link in links), links

    explored = (
        sum(progress.destination_options.values())
        + sum(progress.transfer_options.values())
    )

    def charge(counter, depth):
        nonlocal explored
        if explored >= limits.maximum_search_work:
            progress.incomplete_reason = "candidate_budget"
            return False
        explored += 1
        counter[depth] += 1
        return True

    def explore(state, remaining, visited_codes):
        fractions, links = suffix_options(state.variant_id, remaining, visited_codes)
        start = bisect_right(fractions, state.boarding.fraction)
        depth = len(state.transfers)
        if remaining == 0:
            for index in range(start, len(fractions)):
                if not charge(progress.destination_options, depth):
                    return
                destination = destinations[state.variant_id][index]
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
            return

        for index in range(start, len(links)):
            if not charge(progress.transfer_options, depth):
                return
            link = links[index]
            ride = _RideRequest(
                variant_id=state.variant_id,
                boarding=state.boarding,
                alighting=link.alighting_position,
            )
            next_state = _SearchState(
                variant_id=link.to_variant_id,
                boarding=link.boarding_position,
                access_distance_meters=state.access_distance_meters,
                rides=(*state.rides, ride),
                transfers=(*state.transfers, link),
            )
            yield from explore(
                next_state,
                remaining - 1,
                visited_codes | {route_codes[link.to_variant_id]},
            )
            if progress.incomplete_reason == "candidate_budget":
                return

    # Finish the shallower stages first so an incomplete search can return them.
    for count in range(minimum_transfers, limits.max_transfers + 1):
        for state in origins:
            yield from explore(state, count, frozenset({route_codes[state.variant_id]}))
            if progress.incomplete_reason == "candidate_budget":
                return


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


def coordinate_journey_corridor(journey: CoordinateJeepneyJourney):
    """Group close alternatives along the same sequence before applying an experimental shortlist."""
    return (
        tuple(leg.variant_id for leg in journey.ride_legs),
        tuple(
            tuple(round(value, 3) for value in position.point.coords)
            for link in journey.transfers
            for position in (link.alighting_position, link.boarding_position)
        ),
    )


def _diverse_journeys(
    ranked: Iterable[CoordinateJeepneyJourney],
    limit: int,
) -> list[CoordinateJeepneyJourney]:
    """Keep a representative per corridor before filling remaining result slots."""
    representatives = {}
    alternatives = []
    for journey in ranked:
        corridor = coordinate_journey_corridor(journey)
        if corridor in representatives:
            alternatives.append(journey)
        else:
            representatives[corridor] = journey
    return [*representatives.values(), *alternatives][:limit]


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
        diversify_corridors: bool = False,
        separate_direct_journeys: bool = False,
        include_access_alternatives: bool = False,
        progress: CoordinateJourneySearchProgress | None = None,
    ) -> list[CoordinateJeepneyJourney]:
        """Rank up to three rides, requiring pedestrian evidence by default for any transfer."""
        limits.validate()
        allow_partial = progress is not None
        if progress is None:
            progress = CoordinateJourneySearchProgress()
        routes = valid_route_geometries(route_geometries)
        if any(not route_codes.get(variant_id) for variant_id in routes):
            raise ValidationError({"route_codes": "Provide a route code for each eligible variant."})
        positions = CoordinateRouteMatchingService.find_endpoint_positions(
            origin=origin,
            destination=destination,
            route_geometries=routes,
            maximum_access_distance_meters=limits.maximum_access_distance_meters,
            maximum_egress_distance_meters=limits.maximum_egress_distance_meters,
            include_access_alternatives=include_access_alternatives,
        )
        progress.nearby_origin_variants = len({
            position.variant_id
            for position in positions
            if position.is_boarding
        })
        progress.nearby_destination_variants = len({
            position.variant_id
            for position in positions
            if not position.is_boarding
        })
        if not progress.nearby_origin_variants or not progress.nearby_destination_variants:
            return []

        measurements = {}
        rejected_rides = set()

        def measure_requests(requests):
            """Reuse completed measurements and recover cancellation at a batch boundary."""
            pending = dict.fromkeys(
                ride.key
                for request in requests
                for ride in request.rides
                if ride.key not in measurements and ride.key not in rejected_rides
            )
            for batch in batched(pending, RIDE_MEASUREMENT_BATCH_SIZE):
                try:
                    with transaction.atomic():
                        measured = measure_journey_rides(
                            route_geometries=routes,
                            rides=batch,
                            minimum_ride_distance_meters=limits.minimum_ride_distance_meters,
                        )
                except OperationalError as error:
                    if getattr(error.__cause__, "sqlstate", None) != "57014" or not allow_partial:
                        raise
                    progress.ride_measurement_cancelled = True
                    # The v1 contract represents interrupted candidate evaluation
                    # with its existing candidate-budget reason.
                    if progress.incomplete_reason is None:
                        progress.incomplete_reason = "candidate_budget"
                    break
                measurements.update(measured)
                # Only a successful batch proves that an omitted ride was rejected.
                rejected_rides.update(key for key in batch if key not in measured)
            return list(_measured_journeys(
                requests=requests,
                measurements=measurements,
                route_codes=route_codes,
                transfer_penalty_meters=limits.transfer_penalty_meters,
            ))

        direct_requests = list(_journey_requests(
            positions=positions,
            outgoing={},
            route_codes=route_codes,
            limits=replace(limits, max_transfers=0),
            progress=progress,
        ))
        journeys = measure_requests(direct_requests)
        if progress.incomplete_reason == "candidate_budget" and not allow_partial:
            raise ValidationError({"search": "The itinerary search exceeded its candidate budget."})

        if (
            limits.max_transfers
            and connections is None
            and allow_provisional_transfers
            and progress.incomplete_reason is None
        ):
            try:
                # Recover a cancelled SQL statement inside its own savepoint so
                # a caller's surrounding transaction remains usable.
                with transaction.atomic():
                    connections = RouteConnectionService.discover(
                        route_geometries=routes,
                        route_codes=route_codes,
                        maximum_transfer_distance_meters=limits.maximum_provisional_transfer_distance_meters,
                        progress=progress.connection_discovery,
                    )
            except RouteConnectionBudgetExceeded as error:
                if progress.connection_discovery.stop_reason is None:
                    progress.connection_discovery.stop_reason = error.reason
                if not allow_partial:
                    raise
                progress.incomplete_reason = "connection_budget"
            except OperationalError as error:
                if getattr(error.__cause__, "sqlstate", None) != "57014":
                    raise
                progress.connection_discovery.stop_reason = "sql_cancelled"
                if not allow_partial:
                    raise
                # Preserve the v1 incomplete-coverage enum. Internal telemetry
                # distinguishes SQL cancellation from pair/grid budget limits.
                progress.incomplete_reason = "connection_budget"

        outgoing = {}
        if (
            limits.max_transfers
            and connections is not None
            and progress.incomplete_reason is None
        ):
            outgoing = _eligible_connections(
                candidates=connections,
                routes=routes,
                route_codes=route_codes,
                limits=limits,
                allow_provisional_transfers=allow_provisional_transfers,
            )

        if outgoing and progress.incomplete_reason is None:
            requests = list(_journey_requests(
                positions=positions,
                outgoing=outgoing,
                route_codes=route_codes,
                limits=limits,
                progress=progress,
                minimum_transfers=1,
            ))
            if progress.incomplete_reason == "candidate_budget" and not allow_partial:
                raise ValidationError({"search": "The itinerary search exceeded its candidate budget."})
            journeys.extend(measure_requests(requests))
        if separate_direct_journeys:
            ranked = sorted(journeys, key=coordinate_journey_rank)
            return [
                *_diverse_journeys(
                    (journey for journey in ranked if not journey.transfers),
                    limits.maximum_journeys,
                ),
                *_diverse_journeys(
                    (journey for journey in ranked if journey.transfers),
                    limits.maximum_journeys,
                ),
            ]
        if diversify_corridors:
            return _diverse_journeys(
                sorted(journeys, key=coordinate_journey_rank),
                limits.maximum_journeys,
            )
        return nsmallest(
            limits.maximum_journeys,
            journeys,
            key=coordinate_journey_rank,
        )
