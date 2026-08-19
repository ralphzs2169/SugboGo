import { View, TextInput, Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export default function CommunityTopBar() {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-surface px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between mb-3">
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

      <View className="flex-row items-center rounded-md bg-background border border-brand px-3 py-2">
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={theme.extends.colors.text.tertiary}
        />
        <TextInput
          className="ml-2 flex-1 text-sm text-text-primary"
          placeholder="Find other explorers' insights..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
        />
      </View>
    </View>
  );
}