import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type ReviewSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  children: React.ReactNode;
};

export default function ReviewSection({
  icon,
  title,
  children,
}: ReviewSectionProps) {
  return (
    <View className="mb-4 rounded-xl border border-border-primary px-4 py-4">
      <View className="mb-3 flex-row items-center">
        <MaterialCommunityIcons name={icon} size={22} color="#F27F0D" />

        <Text className="ml-2 text-base font-semibold text-text-primary">
          {title}
        </Text>
      </View>

      <View>{children}</View>
    </View>
  );
}
