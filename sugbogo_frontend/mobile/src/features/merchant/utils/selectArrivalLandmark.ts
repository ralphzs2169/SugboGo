import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/** Selects one arrival point and retains directions for deselected landmarks in the draft. */
export function selectArrivalLandmark(
  landmarks: BusinessLandmark[],
  arrivalDirectionsDrafts: ReadonlyMap<string, string>,
  id: string | null,
) {
  const next = landmarks.find((landmark) => landmark.id === id);

  if (id !== null && !next) {
    return { selectedLandmarks: landmarks, arrivalDirectionsDrafts };
  }

  const drafts = new Map(arrivalDirectionsDrafts);
  const selectedLandmarks = landmarks.map((landmark) => {
    if (landmark === next) {
      return {
        ...landmark,
        is_arrival_point: true,
        access_directions: landmark.is_arrival_point
          ? (landmark.access_directions ?? "")
          : (drafts.get(landmark.id) ?? ""),
      };
    }

    if (landmark.is_arrival_point) {
      drafts.set(landmark.id, landmark.access_directions ?? "");
      return {
        ...landmark,
        is_arrival_point: false,
        access_directions: "",
      };
    }

    return landmark;
  });

  return { selectedLandmarks, arrivalDirectionsDrafts: drafts };
}
