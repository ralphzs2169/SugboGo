import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

type LandmarkPickerHeaderProps = {
  onClose: () => void;
};

/**
 * Displays compact navigation context above the custom-landmark map.
 *
 * Keeps the map visually dominant with a restrained floating header that
 * provides navigation and concise context for landmark placement.
 */
export default function LandmarkPickerHeader({
  onClose,
}: LandmarkPickerHeaderProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0 z-10 px-screen-x"
    >
      {/* Landmark picker navigation and context */}
      <View
        className="flex-row items-center rounded-2xl border border-border-primary bg-surface px-2 py-2"
        style={shadows.floating}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Go back without adding landmark"
          className="h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-secondary active:opacity-60"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={23}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View className="ml-3 min-w-0 flex-1 pr-3">
          <AppText
            weight="bold"
            className="text-[15px] leading-5 text-text-primary"
            numberOfLines={1}
          >
            Add custom landmark
          </AppText>

          <AppText
            className="mt-0.5 text-xs leading-4 text-text-secondary"
            numberOfLines={1}
          >
            Choose a point near your business
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}
