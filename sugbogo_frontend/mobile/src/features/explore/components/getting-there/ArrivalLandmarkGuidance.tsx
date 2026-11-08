import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { ArrivalLandmark } from "../../types/directJourney.types";
import MerchantAccessDirections from "./MerchantAccessDirections";

/** Explains the arrival reference and preserves its specific merchant directions online and offline. */
export default function ArrivalLandmarkGuidance({
  landmark,
}: {
  landmark?: ArrivalLandmark | null;
}) {
  if (!landmark) return null;

  return (
    <View className="mt-3">
      {/* The stop is a transit location; the landmark is the start of merchant instructions. */}
      <AppText weight="semibold" className="text-sm text-text-primary">
        Continue via {landmark.name}
      </AppText>
      <AppText className="mt-1 text-xs leading-5 text-text-secondary">
        Your destination is beyond this arrival landmark. Follow the merchant
        directions below. The connection from the stop is approximate, not a
        calculated walking route.
      </AppText>
      <MerchantAccessDirections
        directions={landmark.access_directions}
        presentation="inline"
      />
    </View>
  );
}
