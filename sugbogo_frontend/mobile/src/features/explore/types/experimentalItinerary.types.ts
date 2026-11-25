export type ItineraryCoordinate = { latitude: number; longitude: number };
export type TransferLimit = 0 | 1 | 2;
export type RouteAlignmentStatus = "unreviewed" | "reviewed" | "disputed";

export type WalkStatus =
  | "available"
  | "no_route"
  | "timeout"
  | "quota_or_billing"
  | "provider_error"
  | "invalid_coordinates"
  | "unsuitable_endpoints"
  | "prohibited_access"
  | "distance_limit"
  | "budget_exhausted"
  | "not_evaluated";

type ItineraryContext = {
  business_id: number;
  origin: ItineraryCoordinate;
  destination: ItineraryCoordinate;
  max_transfers: TransferLimit;
};

type ItineraryTotals = {
  mapped_walking_distance_meters: number | null;
  straight_line_walking_distance_meters: number;
  ride_distance_meters: number;
  transfer_penalty_meters: number;
  ranking_cost_meters: number;
};

type ItineraryStatus = {
  rank: number;
  transfer_count: TransferLimit;
  route_alignment_status: RouteAlignmentStatus;
  passenger_access_verified: boolean;
  passenger_ready: boolean;
  has_blocking_evidence: boolean;
};

export type ItineraryOption = ItineraryStatus & ItineraryTotals & {
  selection: string;
  route_sequence: string[];
  walking_statuses: WalkStatus[];
};

export type ItinerarySearchResult = ItineraryContext & {
  options: ItineraryOption[];
  reason:
    | "no_geometric_journey"
    | "no_route_near_origin"
    | "no_route_near_destination"
    | "no_forward_journey"
    | "candidate_excluded_by_validation"
    | "search_incomplete"
    | null;
  validation_stage?: "spatial" | "minimum_ride_distance" | null;
  coverage: {
    incomplete_reason: "candidate_budget" | "connection_budget" | null;
    variants_excluded_by_spatial_validation: number;
    geometric_candidates_considered: number;
    geometric_candidates_truncated: boolean;
    candidates_evaluated: number;
    alternatives_unchecked: boolean;
    walking_checks_deferred: boolean;
    walking_provider_unavailable?: boolean;
    nearby_origin_variants?: number;
    nearby_destination_variants?: number;
  };
};

export type ItineraryWalk = {
  from: ItineraryCoordinate | null;
  to: ItineraryCoordinate | null;
  status: WalkStatus;
  diagnostic_code: string | null;
  straight_line_distance_meters: number;
  mapped_distance_meters: number | null;
  duration_seconds: number | null;
  encoded_polyline: string | null;
  provider_start: ItineraryCoordinate | null;
  provider_distance_meters?: number | null;
  distance_limit_meters?: number | null;
  provider_end: ItineraryCoordinate | null;
  source: "google_routes" | null;
  warnings: string[];
};

type ItineraryLandmark = {
  place_id: string;
  name: string;
  address: string;
  location: ItineraryCoordinate;
  distance_meters: number;
  source: "google_places";
  attributions: { name: string; url: string }[];
};

export type ItineraryAccess = {
  route_position: ItineraryCoordinate & { fraction: number };
  access_coordinate: ItineraryCoordinate | null;
  coordinate_status: "provisional" | "verified" | "invalid";
  permission: "unknown" | "permitted" | "prohibited";
  passenger_location_verified: boolean;
  landmark: ItineraryLandmark | null;
};

export type ItineraryRide = {
  variant_id: number;
  geometry_revision: string;
  route_code: string;
  route_alignment_status: RouteAlignmentStatus;
  route_provenance: string | null;
  direction: { from: string; toward: string };
  boarding: ItineraryAccess;
  alighting: ItineraryAccess;
  ride_distance_meters: number;
  geometry: ItineraryCoordinate[];
};

type ItineraryTransfer = {
  from_variant_id: number;
  to_variant_id: number;
  validation_status: "provisional" | "pedestrian_validated" | "non_walkable";
  passenger_access_verified: boolean;
  passenger_ready: boolean;
  centerline_gap_meters: number;
  alighting_route_fraction: number;
  boarding_route_fraction: number;
  walk: ItineraryWalk;
};

export type ItineraryDetail = ItineraryContext & ItineraryStatus & {
  access_walk: ItineraryWalk;
  egress_walk: ItineraryWalk;
  ride_legs: ItineraryRide[];
  transfers: ItineraryTransfer[];
  totals: ItineraryTotals;
};
