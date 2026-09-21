import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  onBack: () => void;
  onSearch: () => void;
};

/**
 * Displays the floating navigation and search controls above the origin map.
 *
 * Groups back navigation and place search into one compact surface so map
 * controls remain visually unified without obscuring unnecessary map space.
 */
export default function JourneyOriginMapHeader({ onBack, onSearch }: Props) {
  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0 px-screen-x pt-3"
    >
      {/* Unified map header */}
      <View
        className="flex-row items-center overflow-hidden rounded-full border border-border-primary bg-surface"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: {
            width: 0,
            height: 3,
          },
          elevation: 4,
        }}
      >
        {/* Back navigation */}
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back without changing starting point"
          className="h-12 w-12 shrink-0 cursor-pointer items-center justify-center active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View className="h-6 w-px bg-border-primary" />

        {/* Place search */}
        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search place or landmark"
          className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center px-3.5 active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            className="ml-2.5 min-w-0 flex-1 text-sm text-text-secondary"
            numberOfLines={1}
          >
            Search place or landmark
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
