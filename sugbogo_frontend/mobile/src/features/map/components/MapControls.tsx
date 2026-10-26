import { ActivityIndicator, View, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/shared/constants/layout";
import { theme } from "@/constants/theme";

type Props = {
  onLocateMe: () => void;
  isLocating?: boolean;
  bottomOffset?: number;
};

/** Keeps location checks visible in the control without blocking map gestures. */
export default function MapControls({
  onLocateMe,
  isLocating = false,
  bottomOffset,
}: Props) {
  const insets = useSafeAreaInsets();
  const baseOffset = insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <View
      className="absolute right-md"
      style={{ bottom: bottomOffset ?? baseOffset }}
    >
      <Pressable
        onPress={onLocateMe}
        disabled={isLocating}
        accessibilityRole="button"
        accessibilityLabel={isLocating ? "Checking your location" : "Locate me"}
        accessibilityHint="Centers the map on your current location"
        accessibilityState={{ disabled: isLocating, busy: isLocating }}
        className="h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-brand active:opacity-70"
        style={{ elevation: 4 }}
      >
        {isLocating ? (
          <ActivityIndicator
            color={theme.extends.colors.surface}
            accessible={false}
          />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color={theme.extends.colors.surface}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )}
      </Pressable>
    </View>
  );
}
