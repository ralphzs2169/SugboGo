import { NormalizedLocation } from "../normalizers/normalizeLocation.utils";

/**
 * Compares two landmark arrays.
 *
 * Landmarks are compared field-by-field instead of using a generic
 * deep equality check because only a subset of properties determines
 * whether the location payload has changed.
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

    return (
      landmark.name === other.name &&
      landmark.address === other.address &&
      landmark.latitude === other.latitude &&
      landmark.longitude === other.longitude &&
      landmark.source === other.source &&
      landmark.placeId === other.placeId
    );
  });
}

/**
 * Determines whether the location is still in its default,
 * untouched state.
 *
 * This prevents a brand-new registration from being treated as
 * having unsaved changes before the merchant has entered any data.
 */
function isLocationEmpty(location: NormalizedLocation): boolean {
  return (
    location.province === "" &&
    location.city === "" &&
    location.barangay === "" &&
    location.streetAddress === "" &&
    location.unit === null &&
    location.latitude === null &&
    location.longitude === null &&
    location.landmarks.length === 0
  );
}

/**
 * Determines whether the business location has changed since the
 * last successful save.
 *
 * If nothing has been saved yet (`previous === null`), the location
 * is considered changed only after the merchant has entered some
 * information. This avoids marking untouched forms as having
 * unsaved changes.
 */
export function hasLocationChanged(
  previous: NormalizedLocation | null,
  current: NormalizedLocation,
): boolean {
  if (previous === null) {
    return !isLocationEmpty(current);
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
