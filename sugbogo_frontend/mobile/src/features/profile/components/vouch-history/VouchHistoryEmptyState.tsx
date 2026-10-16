import { Image } from "expo-image";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";

const MASCOT = require("@/shared/assets/mascot/mascot-no-filter-result.webp");

/** Explains an empty eligible history without treating it as a request failure. */
export default function VouchHistoryEmptyState() {
  return (
    <View className="items-center px-8 py-10" testID="vouch-history-empty">
      {/* Empty-history illustration */}
      <Image
        source={MASCOT}
        style={{ width: 120, height: 120 }}
        contentFit="contain"
      />
      {/* Guidance */}
      <AppText
        weight="bold"
        className="mt-2 text-center text-md text-text-primary"
      >
        No vouches yet
      </AppText>
      <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
        Vouch for the specialties you enjoy while exploring local businesses.
      </AppText>
    </View>
  );
}
