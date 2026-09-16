export type DirectJourneyNoRouteReason =
  | "no_nearby_boarding_point"
  | "no_nearby_alighting_point"
  | "no_direct_route_match";

export type DirectJourneyEndpoint = {
  id: number;
  name: string;
};

export type DirectJourneyTransitPoint = DirectJourneyEndpoint & {
  latitude: number;
  longitude: number;
};

export type DirectJourneyLandmarkContext = {
  id: number;
  name: string;
  distance_from_alighting_meters: number;
};

export type DirectJourney = {
  journey_type: "direct";
  jeepney_route_code: string;
  route_variant_id: number;
  route_variant_origin: DirectJourneyEndpoint;
  route_variant_destination: DirectJourneyEndpoint;
  boarding_transit_point: DirectJourneyTransitPoint;
  boarding_sequence: number;
  explorer_to_boarding_distance_meters: number;
  alighting_transit_point: DirectJourneyTransitPoint;
  alighting_sequence: number;
  alighting_to_business_distance_meters: number;
  total_access_egress_distance_meters: number;
  approximate_ride_distance_meters: number;
  landmark_context: DirectJourneyLandmarkContext | null;
};

export type DirectJourneyRouteOption = {
  jeepney_route_code: string;
  recommended_journey: DirectJourney;
  alternative_journeys: DirectJourney[];
};

export type DirectJourneySearchResult = {
  route_options: DirectJourneyRouteOption[];
  reason: DirectJourneyNoRouteReason | null;
};

export type DirectJourneyMapCoordinate = {
  latitude: number;
  longitude: number;
};

export type DirectJourneyMapTransitPoint = DirectJourneyTransitPoint & {
  sequence: number;
};

export type DirectJourneyMapGuidance = {
  jeepney_route_code: string;
  route_variant: {
    id: number;
    origin: DirectJourneyEndpoint;
    destination: DirectJourneyEndpoint;
  };
  boarding_transit_point: DirectJourneyMapTransitPoint;
  alighting_transit_point: DirectJourneyMapTransitPoint;
  ride: {
    approximate_distance_meters: number;
    full_variant_geometry: DirectJourneyMapCoordinate[];
    selected_segment_geometry: DirectJourneyMapCoordinate[];
  };
  business_location: DirectJourneyMapCoordinate;
  landmark_context: DirectJourneyLandmarkContext | null;
};

export type DirectJourneyMapResult = {
  journey: DirectJourneyMapGuidance;
};
