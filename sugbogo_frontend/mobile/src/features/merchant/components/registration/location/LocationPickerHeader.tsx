import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

type LocationPickerHeaderProps = {
  onSearch: () => void;
  onClose: () => void;
};

/**
 * Displays floating navigation and search controls above the business map.
 *
 * Keeps the map visually primary while providing an integrated back action
 * and a compact entry point to business-location search.
 */
export default function LocationPickerHeader({
  onSearch,
  onClose,
}: LocationPickerHeaderProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0 z-10 px-screen-x"
    >
      {/* Map navigation and search */}
      <View
        className="flex-row items-center overflow-hidden rounded-full border border-border-primary bg-surface"
        style={shadows.floating}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Go back without changing business location"
          className="h-12 w-12 cursor-pointer items-center justify-center active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View className="h-7 w-px bg-border-primary" />

        <Pressable
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search your business location"
          className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center px-4 active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            className="ml-3 min-w-0 flex-1 text-sm text-text-secondary"
            numberOfLines={1}
          >
            Search your business location
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
