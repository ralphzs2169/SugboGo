import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";

/**
 * Introduces the Community feed with a compact, typography-focused header.
 *
 * Respects the device's top safe area while keeping explorer reviews
 * visually prioritized over screen-level navigation.
 */
export default function CommunityHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface px-4 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Community introduction */}
      <AppText weight="superbold" className="text-2xl text-text-primary">
        Community
      </AppText>

      <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
        Real experiences from Cebu explorers.
      </AppText>
    </View>
  );
}
