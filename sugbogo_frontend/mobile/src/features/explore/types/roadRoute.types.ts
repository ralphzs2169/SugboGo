export type RoadRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RoadRoute = {
  distance_meters: number;
  duration_seconds: number;
  encoded_polyline: string;
  origin: RoadRouteCoordinate;
  destination: RoadRouteCoordinate;
};

export type RoadRouteSearchResult = {
  route: RoadRoute | null;
};
