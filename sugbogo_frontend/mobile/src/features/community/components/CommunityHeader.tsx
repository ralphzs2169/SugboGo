import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/**
 * Introduces the Community feed and its discovery purpose.
 *
 * The header owns the tab's top safe-area spacing while keeping the feed
 * description concise enough that reviews remain the primary content.
 */
export default function CommunityHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-border-primary bg-surface px-4 pb-4"
      style={{ paddingTop: insets.top + 12 }}
    >
      {/* Community identity */}
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
          <MaterialCommunityIcons
            name="account-group-outline"
            size={24}
            color={theme.extends.colors.brand}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <AppText weight="superbold" className="text-2xl text-text-primary">
            Community
          </AppText>

          <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
            Discover local businesses through real Explorer experiences.
          </AppText>
        </View>
      </View>
    </View>
  );
}
