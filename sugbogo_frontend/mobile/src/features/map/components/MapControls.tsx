import { View, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { TAB_BAR_HEIGHT } from "@/shared/constants/layout";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateMe: () => void;
  isPreviewCardOpen: boolean;
};

/** Provides the existing discovery zoom and recenter actions above the tab bar. */
export default function MapControls({
  onZoomIn,
  onZoomOut,
  onLocateMe,
  isPreviewCardOpen,
}: Props) {
  const insets = useSafeAreaInsets();
  const baseOffset = insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <View
      className="absolute right-md"
      style={{ bottom: isPreviewCardOpen ? baseOffset + 180 : baseOffset }}
    >
      <View
        className="overflow-hidden rounded-input bg-surface"
        style={{ elevation: 4 }}
      >
        <Pressable
          onPress={onZoomIn}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          className="h-12 w-12 cursor-pointer items-center justify-center active:opacity-70"
        >
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Pressable
          onPress={onZoomOut}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          className="h-12 w-12 cursor-pointer items-center justify-center active:opacity-70"
        >
          <MaterialCommunityIcons
            name="minus"
            size={20}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onLocateMe}
        accessibilityRole="button"
        accessibilityLabel="Locate me"
        className="mt-sm h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-brand active:opacity-70"
        style={{ elevation: 4 }}
      >
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={22}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}
