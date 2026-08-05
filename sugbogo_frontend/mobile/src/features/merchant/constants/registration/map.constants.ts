/**
 * Simplified map style for business location selection.
 *
 * Hides Google business points of interest to reduce visual
 * clutter and prevent confusion with the app's custom markers.
 */
export const MAP_STYLE = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
];

/**
 * Maximum distance from the business where a custom landmark
 * may be placed.
 */
export const LANDMARK_RADIUS_METERS = 1000;
