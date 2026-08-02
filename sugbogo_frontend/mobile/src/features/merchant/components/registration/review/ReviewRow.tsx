import { View, Text } from "react-native";

type ReviewRowProps = {
  label: string;
  value?: string;
};

export default function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <View className="mb-2">
      <Text className="text-xs font-medium text-text-secondary">{label}</Text>

      <Text className="mt-1 text-sm text-text-primary">
        {value || "Not provided"}
      </Text>
    </View>
  );
}
