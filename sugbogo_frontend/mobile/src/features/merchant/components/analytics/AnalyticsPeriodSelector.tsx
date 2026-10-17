import { View } from "react-native";

import FilterChip from "@/shared/components/FilterChip";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

type Props = {
  period: MerchantAnalyticsPeriod;
  onChange: (period: MerchantAnalyticsPeriod) => void;
};

const PERIODS = ["7", "30", "90"] as const;

/** Keeps the reporting selection available while analytics sections load or fail. */
export default function AnalyticsPeriodSelector({ period, onChange }: Props) {
  return (
    <View className="flex-row flex-wrap gap-3 py-2">
      {/* Supported reporting periods */}
      {PERIODS.map((option) => (
        <View key={option} className="min-h-12 justify-center">
          <FilterChip
            label={`${option} days`}
            selected={period === option}
            onPress={() => onChange(option)}
            showSelectedCheck
            accessibilityLabel={`Last ${option} days`}
          />
        </View>
      ))}
    </View>
  );
}
