import { View, Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export default function MapTopBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface px-screen-x pb-md"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold tracking-[0.5px]">
          <Text className="text-brand">Sugbo</Text>
          <Text className="text-text-primary">Go</Text>
        </Text>
        <Pressable hitSlop={12}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>
    </View>
  );
}