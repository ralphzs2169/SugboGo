import type { SavedJourneySnapshot } from "../savedJourney.utils";

export const snapshot: SavedJourneySnapshot = {
  formatVersion: 1,
  savedAt: "2026-10-14T01:00:00.000Z",
  business: { id: 21, name: "Fixture destination" },
  origin: { latitude: 10.31, longitude: 123.89, label: "Saved start" },
  journey: {
    jeepney_route_code: "14D",
    route_variant: {
      id: 8,
      origin: { id: 1, name: "Origin" },
      destination: { id: 4, name: "Destination" },
    },
    boarding_transit_point: {
      id: 2,
      name: "Board here",
      latitude: 10.31,
      longitude: 123.89,
      sequence: 2,
    },
    alighting_transit_point: {
      id: 4,
      name: "Get off here",
      latitude: 10.3,
      longitude: 123.9,
      sequence: 4,
    },
    ride: {
      approximate_distance_meters: 3000,
      full_variant_geometry: [
        { latitude: 10.31, longitude: 123.89 },
        { latitude: 10.3, longitude: 123.9 },
      ],
      selected_segment_geometry: [
        { latitude: 10.31, longitude: 123.89 },
        { latitude: 10.3, longitude: 123.9 },
      ],
    },
    business_location: { latitude: 10.3, longitude: 123.9 },
    landmark_context: null,
  },
};
