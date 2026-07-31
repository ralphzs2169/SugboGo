export type BusinessLocationAddress = {
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  formattedAddress: string;
};

export type BusinessLocation = BusinessLocationAddress & {
  latitude: number;
  longitude: number;
};

// Represents a place suggestion returned by Google Places autocomplete.
export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

/**
 * Represents a nearby place that can be used
 * as an optional business landmark.
 */
export type NearbyLandmark = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};
