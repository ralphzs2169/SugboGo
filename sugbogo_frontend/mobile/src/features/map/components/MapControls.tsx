import { View, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/shared/constants/layout";

type Props = {
  onLocateMe: () => void;
  bottomOffset?: number;
};

/** Keeps the discovery location action above the tab bar and selected preview. */
export default function MapControls({ onLocateMe, bottomOffset }: Props) {
  const insets = useSafeAreaInsets();
  const baseOffset = insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <View
      className="absolute right-md"
      style={{ bottom: bottomOffset ?? baseOffset }}
    >
      <Pressable
        onPress={onLocateMe}
        accessibilityRole="button"
        accessibilityLabel="Locate me"
        className="h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-brand active:opacity-70"
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
