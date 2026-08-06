import { ApplicationLocationPayload } from "../../../types/registration/registrationApi.types";
import { normalizeOptionalText } from "../normalizeOptionalText.utils";

/**
 * Compares two landmark arrays in order.
 */
function areLandmarksEqual(
  a: ApplicationLocationPayload["landmarks"] = [],
  b: ApplicationLocationPayload["landmarks"] = [],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((landmark, index) => {
    const other = b[index];

    return (
      landmark.name === other.name &&
      normalizeOptionalText(landmark.address) ===
        normalizeOptionalText(other.address) &&
      landmark.latitude === other.latitude &&
      landmark.longitude === other.longitude &&
      landmark.source === other.source &&
      normalizeOptionalText(landmark.place_id) ===
        normalizeOptionalText(other.place_id)
    );
  });
}

/**
 * Determines whether the business location payload has changed
 * since the last successful save.
 */
export function hasLocationChanged(
  previous: ApplicationLocationPayload | null,
  current: ApplicationLocationPayload,
): boolean {
  // Nothing has ever been saved, so we must save.
  if (previous === null) {
    return true;
  }

  return (
    previous.province !== current.province ||
    previous.city !== current.city ||
    previous.barangay !== current.barangay ||
    previous.street_address !== current.street_address ||
    normalizeOptionalText(previous.unit) !==
      normalizeOptionalText(current.unit) ||
    previous.latitude !== current.latitude ||
    previous.longitude !== current.longitude ||
    !areLandmarksEqual(previous.landmarks, current.landmarks)
  );
}
