import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/**
 * Returns whether a landmark name already exists.
 *
 * Comparison is case-insensitive and ignores
 * leading/trailing whitespace.
 */
export function isDuplicateLandmarkName(
  name: string,
  landmarks: BusinessLandmark[],
) {
  const normalized = name.trim().toLowerCase();

  return landmarks.some(
    (landmark) => landmark.name.trim().toLowerCase() === normalized,
  );
}
