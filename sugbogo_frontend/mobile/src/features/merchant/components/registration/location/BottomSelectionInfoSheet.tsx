import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

/**
 * Guides the merchant before a business location has been selected.
 *
 * Keeps the map visually primary while using restrained brand accents and
 * clearly spaced guidance for search and direct map selection.
 */
export default function BottomSelectionInfoSheet() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-border-primary bg-surface px-screen-x pt-5"
      style={[
        shadows.docked,
        {
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {/* Location-selection guidance */}
      <View className="flex-row items-start">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand">
          <MaterialCommunityIcons
            name="store-marker-outline"
            size={22}
            color="white"
          />
        </View>

        <View className="ml-3.5 min-w-0 flex-1">
          <AppText
            weight="bold"
            className="text-[10px] uppercase tracking-wide text-brand"
          >
            Business location
          </AppText>

          <AppText
            weight="bold"
            className="mt-1 text-base leading-5 text-text-primary"
          >
            Pin where customers can find you
          </AppText>

          <AppText className="mt-1.5 text-sm leading-5 text-text-secondary">
            Search for your business above or select its location directly on
            the map.
          </AppText>
        </View>
      </View>

      {/* Selection methods */}
      <View className="ml-14 mt-4 border-t border-border-primary pt-3">
        <View className="flex-row items-center">
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="magnify"
              size={16}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="medium"
              className="ml-1.5 text-xs text-text-secondary"
            >
              Search a place
            </AppText>
          </View>

          <View className="mx-3 h-1.5 w-1.5 rounded-full bg-brand" />

          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="gesture-tap"
              size={16}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="medium"
              className="ml-1.5 text-xs text-text-secondary"
            >
              Tap the map
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
