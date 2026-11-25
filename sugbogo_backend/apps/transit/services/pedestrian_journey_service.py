"""Evaluate a bounded geometric itinerary shortlist with request-scoped Google data."""

from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, replace
from enum import StrEnum
from time import monotonic

import requests
from django.contrib.gis.geos import LineString, Point
from rest_framework.exceptions import ValidationError

from apps.shared.services.google_maps_service import GoogleMapsService, GoogleNearbyLandmark
from apps.shared.services.google_routes_service import (
    GoogleRoutesService,
    GoogleWalkingResult,
    GoogleWalkingRoute,
    GoogleWalkingStatus,
)
from apps.transit.services.coordinate_journey_service import (
    CoordinateJeepneyJourney,
    CoordinateJourneySearchLimits,
    CoordinateJourneyService,
    coordinate_journey_corridor,
    coordinate_journey_rank,
)
from apps.transit.services.coordinate_route_matching_service import validate_distance
from apps.transit.services.pedestrian_access_service import (
    MAXIMUM_ACCESS_OFFSET_METERS,
    AccessCoordinateStatus,
    AccessLocationEvidence,
    AccessLocationKey,
    AccessPermission,
    AccessUse,
    PedestrianAccessLocation,
    PedestrianAccessService,
)
from apps.transit.services.route_connection_service import RouteConnection, TransferValidationStatus


class WalkingEvaluationStatus(StrEnum):
    """Describe local reasons a pedestrian leg could not be used."""

    PROHIBITED_ACCESS = "prohibited_access"
    DISTANCE_LIMIT = "distance_limit"
    BUDGET_EXHAUSTED = "budget_exhausted"
    NOT_EVALUATED = "not_evaluated"


@dataclass(frozen=True)
class PedestrianEvaluationLimits:
    """Bound calls and set experimental access and walking tolerances."""

    maximum_candidates: int = 3
    maximum_walking_requests: int = 12
    maximum_landmark_requests: int = 6
    maximum_access_offset_meters: float = MAXIMUM_ACCESS_OFFSET_METERS
    maximum_endpoint_displacement_meters: float = GoogleRoutesService.WALK_MAXIMUM_ENDPOINT_DISPLACEMENT_METERS
    maximum_access_or_egress_walk_meters: float = 800.0
    maximum_transfer_walk_meters: float = 350.0
    provider_request_window_seconds: float | None = None

    def validate(self):
        """Keep network work within hard per-evaluation ceilings."""
        for field, count, lower, ceiling in (
            ("maximum_candidates", self.maximum_candidates, 1, 6),
            ("maximum_walking_requests", self.maximum_walking_requests, 0, 24),
            ("maximum_landmark_requests", self.maximum_landmark_requests, 0, 12),
        ):
            if type(count) is not int or not lower <= count <= ceiling:
                raise ValidationError({field: f"Provide an integer from {lower} to {ceiling}."})
        for field, distance in (
            ("maximum_access_offset_meters", self.maximum_access_offset_meters),
            ("maximum_endpoint_displacement_meters", self.maximum_endpoint_displacement_meters),
            ("maximum_access_or_egress_walk_meters", self.maximum_access_or_egress_walk_meters),
            ("maximum_transfer_walk_meters", self.maximum_transfer_walk_meters),
        ):
            validate_distance(field, distance)
        if self.provider_request_window_seconds is not None:
            validate_distance("provider_request_window_seconds", self.provider_request_window_seconds)


@dataclass(frozen=True)
class PedestrianWalkEvidence:
    """Keep requested locations, straight-line estimates, and the provider result distinct."""

    origin: Point | None
    destination: Point | None
    straight_line_distance_meters: float
    status: GoogleWalkingStatus | WalkingEvaluationStatus
    route: GoogleWalkingRoute | None = None
    diagnostic_code: str | None = None
    distance_limit_meters: float | None = None

    @property
    def mapped_distance_meters(self) -> int | None:
        """Return network distance only when the provider path passed evaluation."""
        if self.status is GoogleWalkingStatus.AVAILABLE and self.route is not None:
            return self.route.distance_meters
        return None

    @property
    def ranking_distance_meters(self) -> float:
        """Fall back to the explicit straight-line estimate for an unresolved walk."""
        distance = self.mapped_distance_meters
        return self.straight_line_distance_meters if distance is None else distance


@dataclass(frozen=True)
class PedestrianRideAccess:
    """Retain access evidence and optional display context for one ride."""

    boarding: PedestrianAccessLocation
    alighting: PedestrianAccessLocation
    boarding_landmark: GoogleNearbyLandmark | None = None
    alighting_landmark: GoogleNearbyLandmark | None = None


@dataclass(frozen=True)
class PedestrianTransferEvaluation:
    """Attach mapped walking and independent access evidence to a directed connection."""

    connection: RouteConnection
    walking: PedestrianWalkEvidence
    alighting: PedestrianAccessLocation
    boarding: PedestrianAccessLocation

    @property
    def passenger_ready(self) -> bool:
        """Require both usable pedestrian routing and independently permitted endpoints."""
        return (
            self.connection.validation_status is TransferValidationStatus.PEDESTRIAN_VALIDATED
            and self.alighting.passenger_location_verified
            and self.boarding.passenger_location_verified
        )


@dataclass(frozen=True)
class PedestrianJourneyEvaluation:
    """A request-scoped evaluation of an unchanged geometric itinerary."""

    journey: CoordinateJeepneyJourney
    ride_access: tuple[PedestrianRideAccess, ...]
    access_walk: PedestrianWalkEvidence
    transfers: tuple[PedestrianTransferEvaluation, ...]
    egress_walk: PedestrianWalkEvidence

    @property
    def walks(self) -> tuple[PedestrianWalkEvidence, ...]:
        """Return access, transfer, and egress walks in travel order."""
        return (
            self.access_walk,
            *(transfer.walking for transfer in self.transfers),
            self.egress_walk,
        )

    @property
    def mapped_walking_distance_meters(self) -> int | None:
        """Return a complete network distance only when all walks are available."""
        distances = [walk.mapped_distance_meters for walk in self.walks]
        if any(distance is None for distance in distances):
            return None
        return sum(distance for distance in distances if distance is not None)

    @property
    def passenger_ready(self) -> bool:
        """Require a mapped path for every walk and verified permission at every stop action."""
        return (
            self.mapped_walking_distance_meters is not None
            and all(transfer.passenger_ready for transfer in self.transfers)
            and all(
                location.passenger_location_verified
                for ride in self.ride_access
                for location in (ride.boarding, ride.alighting)
            )
        )

    @property
    def has_blocking_evidence(self) -> bool:
        """Distinguish an unsuitable itinerary from one with missing provider evidence."""
        return self.blocking_walk_count > 0

    @property
    def blocking_walk_count(self) -> int:
        """Count walking legs that failed validation before comparing their costs."""
        return sum(
            walk.status in (
                GoogleWalkingStatus.NO_ROUTE,
                GoogleWalkingStatus.UNSUITABLE_ENDPOINTS,
                GoogleWalkingStatus.INVALID_COORDINATES,
                WalkingEvaluationStatus.DISTANCE_LIMIT,
                WalkingEvaluationStatus.PROHIBITED_ACCESS,
            )
            for walk in self.walks
        )

    @property
    def ranking_cost_meters(self) -> float:
        """Combine evaluated access distances with the existing transfer penalty."""
        return sum(walk.ranking_distance_meters for walk in self.walks) + self.journey.transfer_penalty_meters


class _EvaluationRequests:
    """Deduplicate exact coordinate requests within one evaluation, without durable storage."""

    def __init__(self, limits: PedestrianEvaluationLimits):
        """Start fresh Google request budgets for this search."""
        self.limits = limits
        self.walks = {}
        self.landmarks = {}
        self.routes_quota_exhausted = False
        self.places_quota_exhausted = False
        self.deadline = None
        if limits.provider_request_window_seconds is not None:
            self.deadline = monotonic() + limits.provider_request_window_seconds

    def window_open(self):
        """Allow cached evidence after the provider scheduling window closes."""
        return self.deadline is None or monotonic() < self.deadline

    def walking(
        self,
        origin: Point,
        destination: Point,
    ) -> GoogleWalkingResult | None:
        """Return a directed walking result or None when the network budget is exhausted."""
        key = (origin.coords, destination.coords)
        if key in self.walks:
            return self.walks[key]
        if self.routes_quota_exhausted:
            return GoogleWalkingResult(GoogleWalkingStatus.QUOTA_OR_BILLING)
        if len(self.walks) >= self.limits.maximum_walking_requests or not self.window_open():
            return None

        result = GoogleRoutesService.compute_walking_route(
            origin_latitude=origin.y,
            origin_longitude=origin.x,
            destination_latitude=destination.y,
            destination_longitude=destination.x,
            maximum_endpoint_displacement_meters=self.limits.maximum_endpoint_displacement_meters,
        )
        self.walks[key] = result
        self.routes_quota_exhausted = result.status is GoogleWalkingStatus.QUOTA_OR_BILLING
        return result

    def landmark(self, location: PedestrianAccessLocation) -> GoogleNearbyLandmark | None:
        """Find display context within the request budget without changing access evidence."""
        point = location.point
        if point is None or location.permission is AccessPermission.PROHIBITED:
            return None
        key = point.coords
        if key in self.landmarks:
            return self.landmarks[key]
        if (
            self.places_quota_exhausted
            or len(self.landmarks) >= self.limits.maximum_landmark_requests
            or not self.window_open()
        ):
            return None
        landmark = None
        try:
            landmark = GoogleMapsService.search_transit_landmark(point.y, point.x)
        except requests.HTTPError as error:
            self.places_quota_exhausted = (
                error.response is not None
                and error.response.status_code in (402, 429)
            )
        except (requests.RequestException, ValueError):
            pass
        self.landmarks[key] = landmark
        return landmark


def _shortlist(
    *,
    journeys: Iterable[CoordinateJeepneyJourney],
    evidence: Mapping[AccessLocationKey, AccessLocationEvidence],
    limits: PedestrianEvaluationLimits,
):
    """Prefer checkable candidates and spread requests across different transfer areas."""
    prepared = []
    for rank, journey in enumerate(journeys):
        ride_access = tuple(
            PedestrianRideAccess(
                boarding=PedestrianAccessService.evaluate(
                    variant_id=leg.variant_id,
                    position=leg.boarding_position,
                    use=AccessUse.BOARDING,
                    evidence=evidence,
                    maximum_offset_meters=limits.maximum_access_offset_meters,
                ),
                alighting=PedestrianAccessService.evaluate(
                    variant_id=leg.variant_id,
                    position=leg.alighting_position,
                    use=AccessUse.ALIGHTING,
                    evidence=evidence,
                    maximum_offset_meters=limits.maximum_access_offset_meters,
                ),
            )
            for leg in journey.ride_legs
        )
        locations = [
            location
            for ride in ride_access
            for location in (ride.boarding, ride.alighting)
        ]
        checkable = all(
            location.point is not None and location.permission is not AccessPermission.PROHIBITED
            for location in locations
        )
        verified = all(
            location.passenger_location_verified
            for location in locations
        )
        prepared.append((not checkable, not verified, rank, journey, ride_access))

    area_counts = Counter()
    candidates = []
    for uncheckable, unverified, rank, journey, ride_access in sorted(
        prepared,
        key=lambda candidate: candidate[:3],
    ):
        # Rounded cells promote diversity only. Every provider request uses the exact access coordinates.
        area = (uncheckable, coordinate_journey_corridor(journey))
        priority = (uncheckable, area_counts[area], unverified, rank)
        area_counts[area] += 1
        candidates.append((priority, journey, ride_access, not uncheckable))
    candidates.sort(key=lambda candidate: candidate[0])
    # Direct alternatives need diversity at both access ends, even on one line.
    selected = []
    used_endpoints = Counter()
    while candidates and len(selected) < limits.maximum_candidates:
        def priority(candidate):
            base, journey, _, _ = candidate
            endpoint_keys = tuple(
                (leg.variant_id, action, round(position.point.x, 4), round(position.point.y, 4))
                for leg in journey.ride_legs
                for action, position in (
                    ("boarding", leg.boarding_position),
                    ("alighting", leg.alighting_position),
                )
            )
            reuse = sum(used_endpoints[key] for key in endpoint_keys) if not journey.transfers else 0
            return (base[0], base[2], reuse, base[1], base[3])

        candidate = min(candidates, key=priority)
        candidates.remove(candidate)
        selected.append(candidate)
        for leg in candidate[1].ride_legs:
            for action, position in (
                ("boarding", leg.boarding_position),
                ("alighting", leg.alighting_position),
            ):
                used_endpoints[(
                    leg.variant_id,
                    action,
                    round(position.point.x, 4),
                    round(position.point.y, 4),
                )] += 1
    return selected


def _evaluate_walk(
    *,
    origin: Point | None,
    destination: Point | None,
    original_distance_meters: float,
    maximum_distance_meters: float,
    requests_for_search: _EvaluationRequests,
    checkable: bool,
    prohibited: bool,
) -> PedestrianWalkEvidence:
    """Evaluate one leg without confusing provider errors with unavailable paths."""
    distance = original_distance_meters
    route = None
    diagnostic_code = None
    if prohibited:
        status = WalkingEvaluationStatus.PROHIBITED_ACCESS
    elif origin is None or destination is None:
        status = GoogleWalkingStatus.INVALID_COORDINATES
        diagnostic_code = "invalid_access_coordinate"
    elif not checkable:
        status = WalkingEvaluationStatus.NOT_EVALUATED
    else:
        distance = GoogleMapsService.calculate_distance_meters(
            origin.y,
            origin.x,
            destination.y,
            destination.x,
        )
        result = requests_for_search.walking(origin, destination)
        if result is None:
            status = WalkingEvaluationStatus.BUDGET_EXHAUSTED
        else:
            route = result.route
            status = result.status
            diagnostic_code = result.diagnostic_code
            if (
                status is GoogleWalkingStatus.AVAILABLE
                and route is not None
                and route.distance_meters > maximum_distance_meters
            ):
                status = WalkingEvaluationStatus.DISTANCE_LIMIT
    return PedestrianWalkEvidence(
        origin=origin,
        destination=destination,
        straight_line_distance_meters=distance,
        status=status,
        route=route,
        diagnostic_code=diagnostic_code,
        distance_limit_meters=maximum_distance_meters,
    )


def _evaluate_journey(
    *,
    journey: CoordinateJeepneyJourney,
    ride_access: tuple[PedestrianRideAccess, ...],
    origin: Point,
    destination: Point,
    checkable: bool,
    requests_for_search: _EvaluationRequests,
    limits: PedestrianEvaluationLimits,
) -> PedestrianJourneyEvaluation:
    """Evaluate every walking leg and promote transfer evidence only when justified."""
    first = ride_access[0].boarding
    last = ride_access[-1].alighting
    access_walk = _evaluate_walk(
        origin=origin,
        destination=first.point,
        original_distance_meters=journey.access_distance_meters,
        maximum_distance_meters=limits.maximum_access_or_egress_walk_meters,
        requests_for_search=requests_for_search,
        checkable=checkable,
        prohibited=first.permission is AccessPermission.PROHIBITED,
    )
    transfers = []
    for index, connection in enumerate(journey.transfers):
        alighting = ride_access[index].alighting
        boarding = ride_access[index + 1].boarding
        walking = _evaluate_walk(
            origin=alighting.point,
            destination=boarding.point,
            original_distance_meters=connection.straight_line_distance_meters,
            maximum_distance_meters=limits.maximum_transfer_walk_meters,
            requests_for_search=requests_for_search,
            checkable=checkable,
            prohibited=(
                alighting.permission is AccessPermission.PROHIBITED
                or boarding.permission is AccessPermission.PROHIBITED
            ),
        )
        validation_status = TransferValidationStatus.PROVISIONAL
        if (
            walking.mapped_distance_meters is not None
            and alighting.coordinate_status is AccessCoordinateStatus.VERIFIED
            and boarding.coordinate_status is AccessCoordinateStatus.VERIFIED
        ):
            validation_status = TransferValidationStatus.PEDESTRIAN_VALIDATED
        transfers.append(PedestrianTransferEvaluation(
            connection=replace(connection, validation_status=validation_status),
            walking=walking,
            alighting=alighting,
            boarding=boarding,
        ))

    egress_walk = _evaluate_walk(
        origin=last.point,
        destination=destination,
        original_distance_meters=journey.egress_distance_meters,
        maximum_distance_meters=limits.maximum_access_or_egress_walk_meters,
        requests_for_search=requests_for_search,
        checkable=checkable,
        prohibited=last.permission is AccessPermission.PROHIBITED,
    )
    return PedestrianJourneyEvaluation(
        journey=journey,
        ride_access=ride_access,
        access_walk=access_walk,
        transfers=tuple(transfers),
        egress_walk=egress_walk,
    )


def _evaluation_rank(result: PedestrianJourneyEvaluation):
    """Prioritize usable evidence and reuse Phase 2 cost, ride, and identity ordering."""
    return (
        result.has_blocking_evidence,
        result.blocking_walk_count,
        not result.passenger_ready,
        result.mapped_walking_distance_meters is None,
        *coordinate_journey_rank(result.journey, ranking_cost_meters=result.ranking_cost_meters),
    )


class PedestrianJourneyService:
    """Run the experimental pedestrian evaluation after bounded geometric search."""

    @staticmethod
    def search(
        *,
        origin: Point,
        destination: Point,
        route_geometries: Mapping[int, LineString],
        route_codes: Mapping[int, str],
        access_evidence: Mapping[AccessLocationKey, AccessLocationEvidence] | None = None,
        connections: Iterable[RouteConnection] | None = None,
        search_limits: CoordinateJourneySearchLimits = CoordinateJourneySearchLimits(),
        evaluation_limits: PedestrianEvaluationLimits = PedestrianEvaluationLimits(),
    ) -> list[PedestrianJourneyEvaluation]:
        """Rank short-listed paths and enrich the best usable candidate with landmarks."""
        journeys = CoordinateJourneyService.search(
            origin=origin,
            destination=destination,
            route_geometries=route_geometries,
            route_codes=route_codes,
            connections=connections,
            allow_provisional_transfers=True,
            limits=search_limits,
        )
        return PedestrianJourneyService.evaluate_candidates(
            journeys=journeys,
            origin=origin,
            destination=destination,
            access_evidence=access_evidence,
            evaluation_limits=evaluation_limits,
        )

    @staticmethod
    def evaluate_candidates(
        *,
        journeys: Iterable[CoordinateJeepneyJourney],
        origin: Point,
        destination: Point,
        access_evidence: Mapping[AccessLocationKey, AccessLocationEvidence] | None = None,
        evaluation_limits: PedestrianEvaluationLimits = PedestrianEvaluationLimits(),
        direct_journeys: Iterable[CoordinateJeepneyJourney] = (),
    ) -> list[PedestrianJourneyEvaluation]:
        """Evaluate an existing bounded shortlist without repeating geometric discovery."""
        evaluation_limits.validate()
        requests_for_search = _EvaluationRequests(evaluation_limits)
        evidence = access_evidence if access_evidence is not None else {}
        shortlist = _shortlist(
            journeys=direct_journeys,
            evidence=evidence,
            limits=evaluation_limits,
        )
        shortlist.extend(_shortlist(
            journeys=journeys,
            evidence=evidence,
            limits=evaluation_limits,
        ))
        results = [
            _evaluate_journey(
                journey=journey,
                ride_access=ride_access,
                origin=origin,
                destination=destination,
                checkable=checkable,
                requests_for_search=requests_for_search,
                limits=evaluation_limits,
            )
            for _, journey, ride_access, checkable in shortlist
        ]
        results.sort(key=_evaluation_rank)
        if results and not results[0].has_blocking_evidence:
            best = results[0]
            results[0] = replace(
                best,
                ride_access=tuple(
                    replace(
                        ride,
                        boarding_landmark=requests_for_search.landmark(ride.boarding),
                        alighting_landmark=requests_for_search.landmark(ride.alighting),
                    )
                    for ride in best.ride_access
                ),
            )
        return results
