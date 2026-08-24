const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two geographic coordinates.
 *
 * Uses the Haversine formula and returns the distance in kilometers.
 */
export function calculateDistanceInKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(latitude2 - latitude1);
  const longitudeDifference = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Formats a distance for compact mobile discovery UI.
 *
 * When GPS accuracy is poor relative to the calculated distance,
 * the result is rounded to avoid displaying false precision.
 */
export function formatDistance(
  distanceInKm: number,
  accuracyInMeters?: number | null,
): string {
  const distanceInMeters = distanceInKm * 1000;

  if (
    accuracyInMeters !== null &&
    accuracyInMeters !== undefined &&
    accuracyInMeters > 100
  ) {
    if (distanceInMeters < accuracyInMeters) {
      return "Nearby";
    }

    if (distanceInKm < 10) {
      return `~${Math.round(distanceInKm)} km away`;
    }

    return `~${Math.round(distanceInKm)} km away`;
  }

  if (distanceInKm < 1) {
    return `${Math.round(distanceInMeters)} m away`;
  }

  if (distanceInKm < 10) {
    return `${distanceInKm.toFixed(1)} km away`;
  }

  return `${Math.round(distanceInKm)} km away`;
}
