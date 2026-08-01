const MIN_LANDMARK_NAME_LENGTH = 2;
export const MAX_LANDMARK_NAME_LENGTH = 50;

export type LandmarkNameErrors = {
  name?: string;
};

export function validateLandmarkName(name: string): LandmarkNameErrors {
  const normalized = name.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return {
      name: "Please enter a landmark name.",
    };
  }

  if (normalized.length < MIN_LANDMARK_NAME_LENGTH) {
    return {
      name: `Landmark names must be at least ${MIN_LANDMARK_NAME_LENGTH} characters.`,
    };
  }

  if (normalized.length > MAX_LANDMARK_NAME_LENGTH) {
    return {
      name: `Landmark names must be ${MAX_LANDMARK_NAME_LENGTH} characters or less.`,
    };
  }

  return {};
}
