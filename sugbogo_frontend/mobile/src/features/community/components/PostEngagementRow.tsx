import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  helpfulCount: number;
  repliesCount: number;
  isHelpful: boolean;
  onToggleHelpful: () => void;
};

export default function PostEngagementRow({
  helpfulCount,
  repliesCount,
  isHelpful,
  onToggleHelpful,
}: Props) {
  return (
    <View className="flex-row items-center px-4 py-2">
      <Pressable onPress={onToggleHelpful} className="flex-row items-center mr-4" hitSlop={8}>
        <MaterialCommunityIcons
          name={isHelpful ? "thumb-up" : "thumb-up-outline"}
          size={16}
          color={isHelpful ? theme.extends.colors.brand : theme.extends.colors.text.secondary}
        />
        <Text
          className={`ml-1 text-xs font-medium ${
            isHelpful ? "text-brand" : "text-text-secondary"
          }`}
        >
          {helpfulCount} helpful
        </Text>
      </Pressable>

      <View className="flex-row items-center">
        <MaterialCommunityIcons
          name="comment-outline"
          size={16}
          color={theme.extends.colors.text.secondary}
        />
        <Text className="ml-1 text-xs font-medium text-text-secondary">
          {repliesCount} replies
        </Text>
      </View>
    </View>
  );
}