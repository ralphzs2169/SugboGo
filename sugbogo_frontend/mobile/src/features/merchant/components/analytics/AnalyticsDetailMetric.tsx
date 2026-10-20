import { View } from "react-native";
import AppText from "@/shared/components/AppText";

/** Gives focused reports a shared numeric hierarchy without imposing a card or grid. */
export default function AnalyticsDetailMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <AppText className="text-sm leading-5 text-text-secondary">
        {label}
      </AppText>
      <AppText
        weight="semibold"
        accessibilityLabel={`${label}: ${value === "—" ? "Unavailable" : value}`}
        className="text-3xl tabular-nums text-text-primary"
      >
        {value}
      </AppText>
      {detail && (
        <AppText className="text-small leading-5 text-text-secondary">
          {detail}
        </AppText>
      )}
    </View>
  );
}
