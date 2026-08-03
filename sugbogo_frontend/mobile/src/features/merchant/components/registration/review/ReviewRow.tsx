import { View, Text } from "react-native";

type ReviewRowProps = {
  label: string;
  value?: string;
  emptyText?: string;
  numberOfLines?: number;
  valueClassName?: string;
};

export default function ReviewRow({
  label,
  value,
  emptyText = "Not provided",
  numberOfLines,
  valueClassName = "text-sm text-text-primary",
}: ReviewRowProps) {
  const displayValue = value?.trim() || emptyText;

  return (
    <View className="mb-5">
      <Text className="text-xs font-medium text-text-secondary">{label}</Text>

      <Text
        className={`mt-1 ${valueClassName ?? ""}`}
        numberOfLines={numberOfLines}
      >
        {displayValue}
      </Text>
    </View>
  );
}
