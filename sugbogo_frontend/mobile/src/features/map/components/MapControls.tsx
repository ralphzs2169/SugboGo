import { View, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateMe: () => void;
  isPreviewCardOpen: boolean;
};

export default function MapControls({ onZoomIn, onZoomOut, onLocateMe, isPreviewCardOpen }: Props) {
  return (
    <View className="absolute right-md" style={{ bottom: isPreviewCardOpen ? 200 : 100 }}>
      <View className="overflow-hidden rounded-input bg-surface" style={{ elevation: 4 }}>
        <Pressable onPress={onZoomIn} className="h-10 w-10 items-center justify-center">
          <MaterialCommunityIcons name="plus" size={20} color={theme.extends.colors.text.primary} />
        </Pressable>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Pressable onPress={onZoomOut} className="h-10 w-10 items-center justify-center">
          <MaterialCommunityIcons name="minus" size={20} color={theme.extends.colors.text.primary} />
        </Pressable>
      </View>

      <Pressable
        onPress={onLocateMe}
        className="mt-sm h-12 w-12 items-center justify-center rounded-full bg-brand"
        style={{ elevation: 4 }}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}