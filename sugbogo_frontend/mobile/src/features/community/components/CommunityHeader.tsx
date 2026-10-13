import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";

/**
 * Introduces the Community feed and its discovery purpose.
 *
 * The header owns the tab's top safe-area spacing and stays typographic and
 * compact so reviews remain the primary content.
 */
export default function CommunityHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-border-primary bg-surface px-4 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <AppText weight="superbold" className="text-3xl text-text-primary">
        Community
      </AppText>

      <AppText className="mt-1 text-sm leading-5 text-text-secondary">
        Discover local businesses through real Explorer experiences.
      </AppText>
    </View>
  );
}
