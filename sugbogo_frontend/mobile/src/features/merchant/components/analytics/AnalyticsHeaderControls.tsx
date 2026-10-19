import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

type Props = {
  period: MerchantAnalyticsPeriod;
  onOpenPeriod: () => void;
  onOpenInformation: () => void;
  informationLabel: string;
  informationHint: string;
};

/** Keeps period-based section actions consistent and usable while reports load. */
export default function AnalyticsHeaderControls({
  period,
  onOpenPeriod,
  onOpenInformation,
  informationLabel,
  informationHint,
}: Props) {
  return (
    <View className="shrink-0 flex-row items-center gap-2">
      {/* All activity sections open the same reporting-period sheet. */}
      <SafePressable
        onPress={onOpenPeriod}
        accessibilityRole="button"
        accessibilityLabel={`Change reporting period, currently ${period} days`}
        accessibilityHint="Opens reporting period options for this section"
        className="min-h-11 min-w-11 cursor-pointer flex-row items-center justify-center gap-1 rounded-full px-1 active:bg-surface-muted"
      >
        <AppText weight="semibold" className="text-sm text-text-secondary">
          {period}d
        </AppText>
        <MaterialCommunityIcons
          name="chevron-down"
          size={17}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </SafePressable>

      {/* Measurement explanations remain specific to this section. */}
      <SafePressable
        onPress={onOpenInformation}
        accessibilityRole="button"
        accessibilityLabel={informationLabel}
        accessibilityHint={informationHint}
        className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={22}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </SafePressable>
    </View>
  );
}
