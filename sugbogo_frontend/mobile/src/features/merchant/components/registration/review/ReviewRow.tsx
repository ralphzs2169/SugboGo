import { View } from "react-native";
import type { ReactNode } from "react";
import AppText from "@/shared/components/AppText";

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
        <AppText weight="medium" className="text-xs  text-text-secondary">
          {label}
        </AppText>
      ) : (
        label
      )}

      <AppText
        className={`mt-1 ${valueClassName}`}
        numberOfLines={numberOfLines}
      >
        {displayValue}
      </AppText>
    </View>
  );
}
