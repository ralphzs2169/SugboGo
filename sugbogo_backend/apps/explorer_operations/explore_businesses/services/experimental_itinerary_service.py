"""Bind experimental itinerary selections to current local transit data."""

import hashlib
import json
import logging
from dataclasses import dataclass, replace
from enum import StrEnum
from itertools import pairwise

from django.conf import settings
from django.contrib.gis.geos import LineString, Point
from django.core import signing
from django.db import connection
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.shared.services.google_maps_service import GoogleMapsService, valid_latitude_longitude
from apps.shared.services.google_routes_service import GoogleWalkingStatus
from apps.transit.models import JeepneyRouteVariant
from apps.transit.services.coordinate_journey_service import (
    CoordinateJeepneyJourney,
    CoordinateJourneySearchLimits,
    CoordinateJourneySearchProgress,
    CoordinateJourneyService,
    CoordinateRideLeg,
)
from apps.transit.services.coordinate_route_matching_service import (
    CoordinateRouteMatchingService,
    RoutePosition,
    valid_route_geometries,
)
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.transit.services.pedestrian_access_service import AccessLocationEvidence, AccessPermission, AccessUse
from apps.transit.services.pedestrian_journey_service import (
    PedestrianEvaluationLimits,
    PedestrianJourneyService,
    WalkingEvaluationStatus,
)
from apps.transit.services.route_connection_service import (
    CONNECTION_AREA_METERS,
    RouteConnection,
    TransferValidationStatus,
)
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService
from apps.explorer_operations.explore_businesses.services.experimental_connection_graph_service import (
    ItineraryGraphUnavailable,
    experimental_connection_index,
)

logger = logging.getLogger(__name__)

SELECTION_SALT = "explorer.experimental-itinerary.v1"
SELECTION_MAX_AGE_SECONDS = 600
EVALUATION_LIMITS = PedestrianEvaluationLimits(provider_request_window_seconds=12)
WALKING_PROVIDER_FAILURES = (
    GoogleWalkingStatus.TIMEOUT,
    GoogleWalkingStatus.QUOTA_OR_BILLING,
    GoogleWalkingStatus.PROVIDER_ERROR,
)


class StaleItinerary(APIException):
    """Require a fresh search when a selected itinerary's inputs change."""

    status_code = 409
    default_code = "stale_itinerary"
    default_detail = "This itinerary has changed. Search again for current options."


class ExpiredItinerary(APIException):
    """Signal a valid selection whose freshness window has elapsed."""

    status_code = 410
    default_code = "expired_itinerary"
    default_detail = "This itinerary selection expired. Search again."


class ItineraryEvidenceUnavailable(APIException):
    """Fail closed if trusted route or access evidence cannot be interpreted."""

    status_code = 503
    default_code = "itinerary_evidence_unavailable"
    default_detail = "Experimental review evidence is temporarily unavailable."


class ItinerarySpatialValidationUnavailable(APIException):
    """Fail closed when the local transit network cannot be spatially checked."""

    status_code = 503
    default_code = "itinerary_spatial_validation_unavailable"
    default_detail = "Experimental route validation is temporarily unavailable."


class RouteAlignmentStatus(StrEnum):
    UNREVIEWED = "unreviewed"
    REVIEWED = "reviewed"
    DISPUTED = "disputed"


@dataclass(frozen=True)
class _Variant:
    """Read-only geometry, code and directional labels for this search."""

    geometry: LineString
    code: str
    origin_name: str
    destination_name: str
    revision: str
    alignment_status: RouteAlignmentStatus = RouteAlignmentStatus.UNREVIEWED
    provenance: str | None = None


def _digest(value):
    """Fingerprint stable JSON inputs without storing a provider result."""
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _variants(variant_ids=None, *, rejected_geometries=None):
    """Load structural geometry and terminal names used only as display metadata."""
    queryset = JeepneyRouteVariant.objects.order_by("pk")
    if variant_ids is not None:
        queryset = queryset.filter(pk__in=variant_ids)
    rows = list(queryset.values_list(
        "pk",
        "JRV_GEOMETRY",
        "JRT_ID__JRT_CODE",
        "JRV_ORIGIN_ID__TRPT_NAME",
        "JRV_DESTINATION_ID__TRPT_NAME",
    ))
    if not rows:
        return {}
    try:
        boundary = TransitSpatialValidationService.boundary()
    except ValidationError as error:
        raise ItinerarySpatialValidationUnavailable() from error

    variants = {}
    for variant_id, geometry, code, origin_name, destination_name in rows:
        try:
            TransitSpatialValidationService.validate_geometry(geometry, boundary)
        except ValidationError:
            if rejected_geometries is not None:
                rejected_geometries[variant_id] = geometry
            continue
        variants[variant_id] = _Variant(
            geometry=geometry,
            code=code,
            origin_name=origin_name,
            destination_name=destination_name,
            revision=_digest([geometry.hexewkb.decode(), code]),
        )
    _apply_route_evidence(variants)
    return variants


def _apply_route_evidence(variants):
    """Attach separately supplied provenance and review for the exact stored direction."""
    try:
        records = json.loads(settings.EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE)
        if not isinstance(records, list):
            raise ValueError
        seen = set()
        for record in records:
            variant_id = record["variant_id"]
            if type(variant_id) is not int or variant_id < 1:
                raise ValueError
            variant = variants.get(variant_id)
            if variant is None or record["geometry_revision"] != variant.revision:
                continue
            alignment = RouteAlignmentStatus(record["alignment_status"])
            provenance = record.get("provenance")
            if (
                variant_id in seen
                or (provenance is not None and (
                    not isinstance(provenance, str) or not provenance.strip()
                ))
                or (alignment is RouteAlignmentStatus.REVIEWED and provenance is None)
            ):
                raise ValueError
            seen.add(variant_id)
            variants[variant_id] = replace(
                variant,
                alignment_status=alignment,
                provenance=provenance,
            )
    except (KeyError, TypeError, ValueError) as error:
        raise ItineraryEvidenceUnavailable() from error


def _journey_alignment(result, variants):
    """A reviewed itinerary requires a reviewed stored direction for every ride."""
    statuses = {
        variants[leg.variant_id].alignment_status
        for leg in result.journey.ride_legs
    }
    if RouteAlignmentStatus.DISPUTED in statuses:
        return RouteAlignmentStatus.DISPUTED
    if statuses == {RouteAlignmentStatus.REVIEWED}:
        return RouteAlignmentStatus.REVIEWED
    return RouteAlignmentStatus.UNREVIEWED


def _readiness(result, variants):
    """Keep vehicle alignment and the pedestrian evaluation independent."""
    alignment = _journey_alignment(result, variants)
    access_verified = result.passenger_ready
    return {
        "route_alignment_status": alignment,
        "passenger_access_verified": access_verified,
        "passenger_ready": alignment is RouteAlignmentStatus.REVIEWED and access_verified,
    }


def _geometry_representatives(journeys):
    """Keep separate route sequences and spatially distinct transfer areas."""
    representatives = []
    for journey in journeys:
        sequence = tuple(leg.variant_id for leg in journey.ride_legs)
        duplicate = False
        for retained in representatives:
            if sequence != tuple(leg.variant_id for leg in retained.ride_legs):
                continue
            if all(
                _distance(first.point, second.point) <= CONNECTION_AREA_METERS
                for link, other in zip(journey.transfers, retained.transfers, strict=True)
                for first, second in (
                    (link.alighting_position, other.alighting_position),
                    (link.boarding_position, other.boarding_position),
                )
            ):
                duplicate = True
                break
        if not duplicate:
            representatives.append(journey)
    return representatives


def _access_evidence(variants):
    """Load independently reviewed, revision-bound evidence supplied by the deployment."""
    try:
        records = json.loads(settings.EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE)
        if not isinstance(records, list):
            raise ValueError
        evidence = {}
        for record in records:
            variant_id = record["variant_id"]
            variant = variants.get(variant_id)
            if variant is None or record["geometry_revision"] != variant.revision:
                continue
            fraction = record["fraction"]
            use = AccessUse(record["use"])
            permission = AccessPermission(record["permission"])
            verified = record["coordinate_verified"]
            if (
                type(fraction) not in (int, float)
                or not 0 <= fraction <= 1
                or type(verified) is not bool
            ):
                raise ValueError
            latitude = record.get("latitude")
            longitude = record.get("longitude")
            point = None
            if latitude is not None or longitude is not None or verified:
                if not valid_latitude_longitude(latitude, longitude):
                    raise ValueError
                point = Point(longitude, latitude, srid=4326)
            key = (variant_id, round(fraction, 12), use)
            if key in evidence:
                raise ValueError
            evidence[key] = AccessLocationEvidence(
                point=point,
                coordinate_verified=verified,
                permission=permission,
            )
        return evidence
    except (KeyError, TypeError, ValueError) as error:
        raise ItineraryEvidenceUnavailable() from error


def _evidence_revision(evidence, legs, variants):
    """Bind the selection to route alignment and exact boarding and alighting evidence."""
    entries = []
    for variant_id, boarding, alighting in legs:
        variant = variants[variant_id]
        entries.append([variant_id, variant.alignment_status, variant.provenance])
        for fraction, action in ((boarding, AccessUse.BOARDING), (alighting, AccessUse.ALIGHTING)):
            record = evidence.get((variant_id, round(fraction, 12), action))
            if record is not None:
                entries.append([
                    variant_id,
                    fraction,
                    action,
                    record.point.coords if record.point is not None else None,
                    record.coordinate_verified,
                    record.permission,
                ])
    return _digest(entries)


def _distance(start: Point, end: Point):
    """Measure straight-line meters between two geometric positions."""
    return GoogleMapsService.calculate_distance_meters(start.y, start.x, end.y, end.x)


def _geographic_distances(point_pairs):
    """Batch selected access gaps using the search pipeline's geography semantics."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
                SELECT ST_Distance(
                    ST_GeomFromEWKT(start_wkt)::geography,
                    ST_GeomFromEWKT(end_wkt)::geography
                )
                FROM unnest(%s::text[], %s::text[]) WITH ORDINALITY
                    AS points(start_wkt, end_wkt, position)
                ORDER BY position
            """,
            [
                [
                    start.ewkt
                    for start, _ in point_pairs
                ],
                [
                    end.ewkt
                    for _, end in point_pairs
                ],
            ],
        )
        return [
            distance
            for (distance,) in cursor.fetchall()
        ]


def _restore_journey(
    *,
    payload,
    variants,
    origin,
    destination,
):
    """Rebuild only the signed rides and transitions using current checked geometry."""
    keys = [tuple(leg) for leg in payload["legs"]]
    limits = CoordinateJourneySearchLimits(max_transfers=payload["max_transfers"])
    measurements = CoordinateRouteMatchingService.measure_rides(
        route_geometries={
            variant_id: variant.geometry
            for variant_id, variant in variants.items()
        },
        rides=keys,
        minimum_ride_distance_meters=limits.minimum_ride_distance_meters,
    )
    legs = []
    for key in keys:
        variant_id, boarding, alighting = key
        if key not in measurements:
            raise StaleItinerary()
        line, distance = measurements[key]
        legs.append(CoordinateRideLeg(
            variant_id=variant_id,
            jeepney_route_code=variants[variant_id].code,
            boarding_position=RoutePosition(Point(*line.coords[0], srid=4326), boarding),
            alighting_position=RoutePosition(Point(*line.coords[-1], srid=4326), alighting),
            ride_geometry=line,
            ride_distance_meters=distance,
        ))
    ride_pairs = list(pairwise(legs))
    gaps = _geographic_distances([
        (origin, legs[0].boarding_position.point),
        *[
            (before.alighting_position.point, after.boarding_position.point)
            for before, after in ride_pairs
        ],
        (legs[-1].alighting_position.point, destination),
    ])
    transfers = [
        RouteConnection(
            from_variant_id=before.variant_id,
            to_variant_id=after.variant_id,
            alighting_position=before.alighting_position,
            boarding_position=after.boarding_position,
            straight_line_distance_meters=distance,
            validation_status=TransferValidationStatus.PROVISIONAL,
        )
        for (before, after), distance in zip(ride_pairs, gaps[1:-1], strict=True)
    ]
    access = gaps[0]
    egress = gaps[-1]
    transfer_distance = sum(link.straight_line_distance_meters for link in transfers)
    walking = access + transfer_distance + egress
    penalty = limits.transfer_penalty_meters * len(transfers)
    return CoordinateJeepneyJourney(
        ride_legs=tuple(legs),
        transfers=tuple(transfers),
        access_distance_meters=access,
        transfer_distance_meters=transfer_distance,
        egress_distance_meters=egress,
        approximate_total_walking_distance_meters=walking,
        total_ride_distance_meters=sum(leg.ride_distance_meters for leg in legs),
        transfer_penalty_meters=penalty,
        ranking_cost_meters=walking + penalty,
    )


def _current_selection(payload):
    """Reject geometry, destination, or review changes before using the selected positions."""
    business_id = payload["business"]
    try:
        destination, location_id = DirectJourneyService._get_destination_context(business_id)
    except NotFound as error:
        raise StaleItinerary() from error
    if payload["destination"] != _digest([location_id, destination.coords]):
        raise StaleItinerary()

    variants = _variants([variant_id for variant_id, _ in payload["variants"]])
    if payload["variants"] != [[variant_id, variant.revision] for variant_id, variant in variants.items()]:
        raise StaleItinerary()
    evidence = _access_evidence(variants)
    if payload["evidence"] != _evidence_revision(evidence, payload["legs"], variants):
        raise StaleItinerary()
    return destination, variants, evidence


def _empty_search_reason(
    *,
    origin,
    destination,
    rejected_geometries,
    progress,
    limits,
):
    """Report the stage supported by evidence when no itinerary survived."""
    if progress.incomplete_reason:
        return "search_incomplete", None

    boarding = {}
    alighting = {}
    if rejected_geometries:
        positions = CoordinateRouteMatchingService.find_endpoint_positions(
            origin=origin,
            destination=destination,
            route_geometries=rejected_geometries,
            maximum_access_distance_meters=limits.maximum_access_distance_meters,
            maximum_egress_distance_meters=limits.maximum_egress_distance_meters,
        )
        for position in positions:
            variant_id = position.variant_id
            fraction = position.position.fraction
            if position.is_boarding:
                boarding[variant_id] = min(fraction, boarding.get(variant_id, 1.0))
            else:
                alighting[variant_id] = max(fraction, alighting.get(variant_id, 0.0))

        # Use the longest forward slice on each excluded variant as a witness.
        # These geometries are used only to explain an empty result.
        rejected_rides = {
            (variant_id, boarding[variant_id], alighting[variant_id])
            for variant_id in boarding.keys() & alighting.keys()
            if boarding[variant_id] < alighting[variant_id]
        }
    else:
        rejected_rides = set()

    if not progress.nearby_origin_variants and not boarding:
        return "no_route_near_origin", None
    if not progress.nearby_destination_variants and not alighting:
        return "no_route_near_destination", None
    if (
        not progress.nearby_origin_variants
        or not progress.nearby_destination_variants
        or CoordinateRouteMatchingService.measure_rides(
            route_geometries=rejected_geometries,
            rides=rejected_rides,
            minimum_ride_distance_meters=limits.minimum_ride_distance_meters,
        )
    ):
        return "candidate_excluded_by_validation", "spatial"
    if progress.destination_options:
        return "candidate_excluded_by_validation", "minimum_ride_distance"
    return "no_forward_journey", None


class ExperimentalItineraryService:
    """Search and reopen short-lived experimental itinerary selections."""

    @staticmethod
    def search(
        *,
        business_id,
        user_id,
        latitude,
        longitude,
        max_transfers,
    ):
        """Discover diverse geometric candidates before bounded walking evaluation."""
        origin = Point(longitude, latitude, srid=4326)
        destination, location_id = DirectJourneyService._get_destination_context(business_id)
        rejected_geometries = {}
        variants = _variants(rejected_geometries=rejected_geometries)
        evidence = _access_evidence(variants)
        limits = CoordinateJourneySearchLimits(max_transfers=max_transfers)
        geometries = valid_route_geometries({
            variant_id: variant.geometry
            for variant_id, variant in variants.items()
        })
        progress = CoordinateJourneySearchProgress()
        route_codes = {
            variant_id: variants[variant_id].code
            for variant_id in geometries
        }
        connection_index = experimental_connection_index(
            route_geometries=geometries,
            route_codes=route_codes,
        )
        try:
            geometric = CoordinateJourneyService.search(
                origin=origin,
                destination=destination,
                route_geometries=geometries,
                route_codes=route_codes,
                connection_index=connection_index,
                allow_provisional_transfers=True,
                limits=replace(limits, maximum_journeys=limits.maximum_journeys + 1),
                separate_direct_journeys=True,
                progress=progress,
            )
        except (OSError, ValueError, KeyError) as error:
            if connection_index is None:
                raise
            logger.warning("Local experimental graph read rejected: %s", error)
            raise ItineraryGraphUnavailable() from error
        graph_coverage = {}
        if connection_index is not None:
            graph_coverage = {
                "graph_revision": connection_index.index.revision,
                "graph_variant_count": len(connection_index.graph_to_managed),
                "variants_outside_graph": list(connection_index.uncovered_variant_ids),
            }
            if (
                max_transfers
                and connection_index.uncovered_variant_ids
                and progress.nearby_origin_variants
                and progress.nearby_destination_variants
                and progress.incomplete_reason is None
            ):
                # The existing enum also covers unavailable connection coverage.
                # Direct rides still use every eligible managed variant.
                progress.incomplete_reason = "connection_budget"
            logger.info(
                "Experimental indexed search revision=%s outside_graph=%s progress=%s",
                connection_index.index.revision,
                connection_index.uncovered_variant_ids,
                progress,
            )
        direct_count = sum(
            not journey.transfers
            for journey in geometric
        )
        transfer_count = len(geometric) - direct_count
        geometric_truncated = max(direct_count, transfer_count) > limits.maximum_journeys
        # Retain the best geometric representative of each route sequence/area.
        geometric = _geometry_representatives(geometric)
        direct = [journey for journey in geometric if not journey.transfers]
        transfers = [journey for journey in geometric if journey.transfers]
        direct_pool = direct[:limits.maximum_journeys]
        transfer_pool = transfers[:limits.maximum_journeys]
        evaluated = PedestrianJourneyService.evaluate_candidates(
            journeys=transfer_pool,
            direct_journeys=direct_pool,
            origin=origin,
            destination=destination,
            access_evidence=evidence,
            evaluate_walking=False,
            evaluation_limits=replace(
                EVALUATION_LIMITS,
                maximum_landmark_requests=0,
            ),
        )
        options = []
        for rank, result in enumerate(evaluated, start=1):
            legs = [
                [leg.variant_id, leg.boarding_position.fraction, leg.alighting_position.fraction]
                for leg in result.journey.ride_legs
            ]
            revisions = [
                [variant_id, variants[variant_id].revision]
                for variant_id in sorted(leg.variant_id for leg in result.journey.ride_legs)
            ]
            payload = {
                "user": user_id,
                "business": business_id,
                "origin": origin.coords,
                "destination": _digest([location_id, destination.coords]),
                "max_transfers": max_transfers,
                "legs": legs,
                "variants": revisions,
                "evidence": _evidence_revision(evidence, legs, variants),
                "rank": rank,
            }
            options.append({
                "selection": signing.dumps(payload, salt=SELECTION_SALT, compress=True),
                "rank": rank,
                "result": result,
                **_readiness(result, variants),
            })
        reason = validation_stage = None
        if not options:
            reason, validation_stage = _empty_search_reason(
                origin=origin,
                destination=destination,
                rejected_geometries=rejected_geometries,
                progress=progress,
                limits=limits,
            )
        return {
            "business_id": business_id,
            "origin": origin,
            "destination": destination,
            "max_transfers": max_transfers,
            "options": options,
            "reason": reason,
            "validation_stage": validation_stage,
            "coverage": {
                **graph_coverage,
                "incomplete_reason": progress.incomplete_reason,
                "nearby_origin_variants": progress.nearby_origin_variants,
                "nearby_destination_variants": progress.nearby_destination_variants,
                "variants_excluded_by_spatial_validation": len(rejected_geometries),
                "geometric_candidates_considered": len(direct_pool) + len(transfer_pool),
                "geometric_candidates_truncated": geometric_truncated,
                "candidates_evaluated": len(evaluated),
                "alternatives_unchecked": (
                    progress.incomplete_reason is not None
                    or geometric_truncated
                    or len(geometric) > len(evaluated)
                ),
                "walking_checks_deferred": any(
                    walk.status is WalkingEvaluationStatus.BUDGET_EXHAUSTED
                    for result in evaluated
                    for walk in result.walks
                ),
                "walking_provider_unavailable": any(
                    walk.status in WALKING_PROVIDER_FAILURES
                    for result in evaluated
                    for walk in result.walks
                ),
            },
        }

    @staticmethod
    def detail(
        *,
        business_id,
        user_id,
        selection,
    ):
        """Revalidate and reevaluate a selection without retaining Google content."""
        try:
            payload = signing.loads(selection, salt=SELECTION_SALT, max_age=SELECTION_MAX_AGE_SECONDS)
        except signing.SignatureExpired as error:
            raise ExpiredItinerary() from error
        except (signing.BadSignature, ValueError) as error:
            raise NotFound("Itinerary selection unavailable.") from error
        if payload["user"] != user_id or payload["business"] != business_id:
            raise NotFound("Itinerary selection unavailable.")
        destination, variants, evidence = _current_selection(payload)
        origin = Point(*payload["origin"], srid=4326)
        journey = _restore_journey(payload=payload, variants=variants, origin=origin, destination=destination)
        (result,) = PedestrianJourneyService.evaluate_candidates(
            journeys=[journey],
            origin=origin,
            destination=destination,
            access_evidence=evidence,
            evaluation_limits=EVALUATION_LIMITS,
            evaluate_walking=False,
        )
        _current_selection(payload)
        return {
            "business_id": business_id,
            "origin": origin,
            "destination": destination,
            "max_transfers": payload["max_transfers"],
            "rank": payload["rank"],
            "result": result,
            "variants": variants,
            **_readiness(result, variants),
        }
