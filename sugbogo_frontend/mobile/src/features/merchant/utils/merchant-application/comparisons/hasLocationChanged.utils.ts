import { NormalizedLocation } from "../normalizers/normalizeLocation.utils";
/**
 * Compares two landmark arrays in order.
 */
function areLandmarksEqual(
  a: NormalizedLocation["landmarks"] = [],
  b: NormalizedLocation["landmarks"] = [],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((landmark, index) => {
    const other = b[index];

    return a.every((landmark, index) => {
      const other = b[index];

      return (
        landmark.name === other.name &&
        landmark.address === other.address &&
        landmark.latitude === other.latitude &&
        landmark.longitude === other.longitude &&
        landmark.source === other.source &&
        landmark.placeId === other.placeId
      );
    });
  });
}

/**
 * Determines whether the business location payload has changed
 * since the last successful save.
 */
export function hasLocationChanged(
  previous: NormalizedLocation | null,
  current: NormalizedLocation,
): boolean {
  // Nothing has ever been saved, so we must save.
  if (previous === null) {
    return true;
  }

  return (
    previous.province !== current.province ||
    previous.city !== current.city ||
    previous.barangay !== current.barangay ||
    previous.streetAddress !== current.streetAddress ||
    previous.unit !== current.unit ||
    previous.latitude !== current.latitude ||
    previous.longitude !== current.longitude ||
    !areLandmarksEqual(previous.landmarks, current.landmarks)
  );
}
