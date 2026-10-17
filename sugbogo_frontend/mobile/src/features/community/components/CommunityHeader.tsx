import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";

type Props = {
  children?: ReactNode;
};

/**
 * Pinned Community header: title plus quick-filter controls.
 *
 * Respects the device's top safe area. Controls are passed as children so the
 * header stays presentation-only.
 */
export default function CommunityHeader({ children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-border-primary bg-surface"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Community introduction */}
      <View className="px-4 pb-3">
        <AppText weight="superbold" className="text-2xl text-text-primary">
          Community
        </AppText>
        <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
          Real experiences from Cebu explorers.
        </AppText>
      </View>

      {children}
    </View>
  );
}
