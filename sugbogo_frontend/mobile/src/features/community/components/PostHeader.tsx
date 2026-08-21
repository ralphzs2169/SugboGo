import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  userName: string;
  userAvatarUrl: string;
  timeAgo: string;
  onMenuPress: () => void;
};

export default function PostHeader({ userName, userAvatarUrl, timeAgo, onMenuPress }: Props) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-row items-center">
        <Image source={{ uri: userAvatarUrl }} className="h-10 w-10 rounded-full mr-3" />
        <View>
          <Text className="text-sm font-bold text-text-primary">{userName}</Text>
          <Text className="text-xs text-text-tertiary">{timeAgo}</Text>
        </View>
      </View>
      <Pressable onPress={onMenuPress} hitSlop={12}>
        <MaterialCommunityIcons
          name="dots-horizontal"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>
    </View>
  );
}