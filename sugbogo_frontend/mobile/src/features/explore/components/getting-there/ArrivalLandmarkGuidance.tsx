import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { ArrivalLandmark } from "../../types/directJourney.types";

/** Explains the arrival reference and preserves its specific merchant directions online and offline. */
export default function ArrivalLandmarkGuidance({
  landmark,
}: {
  landmark?: ArrivalLandmark | null;
}) {
  const directions = landmark?.access_directions?.trim();
  if (!landmark || !directions) return null;

  return (
    <View>
      <AppText weight="semibold" className="text-xs text-text-secondary">
        From {landmark.name} · Merchant-provided
      </AppText>
      <AppText selectable className="mt-1 text-sm leading-5 text-text-primary">
        {directions}
      </AppText>
    </View>
  );
}
