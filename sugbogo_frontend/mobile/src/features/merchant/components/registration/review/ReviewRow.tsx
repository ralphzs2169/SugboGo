import { View, Text } from "react-native";
import type { ReactNode } from "react";

type ReviewRowProps = {
  label: ReactNode;
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
      {typeof label === "string" ? (
        <Text className="text-xs font-medium text-text-secondary">{label}</Text>
      ) : (
        label
      )}

      <Text className={`mt-1 ${valueClassName}`} numberOfLines={numberOfLines}>
        {displayValue}
      </Text>
    </View>
  );
}
