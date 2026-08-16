export type BusinessLocationAddress = {
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  formattedAddress: string;
  unit?: string;
};

export type BusinessLocation = BusinessLocationAddress & {
  latitude: number;
  longitude: number;
  isWithinServiceArea: boolean;
};

// Represents a place suggestion returned by Google Places autocomplete.
export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

/**
 * Represents a landmark associated with a business location.
 *
 * Landmarks may either come from Google Places or be
 * manually created by the merchant.
 */
export type BusinessLandmark = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "google" | "custom";
  placeId?: string;
  isSelected?: boolean;
};
