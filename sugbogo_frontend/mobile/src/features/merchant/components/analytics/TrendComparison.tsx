import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import colors from "tailwindcss/colors";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import {
  formatKpiTrend,
  type KpiTrend,
} from "../../utils/merchantKpiComparisons.utils";

const TREND_PRESENTATION = {
  up: {
    icon: "trending-up",
    color: colors.emerald[700],
    textClass: "text-emerald-700",
    description: "Increase",
  },
  down: {
    icon: "trending-down",
    color: colors.red[700],
    textClass: "text-red-700",
    description: "Decrease",
  },
  unchanged: {
    icon: "minus",
    color: theme.extends.colors.text.secondary,
    textClass: "text-text-secondary",
    description: "No change",
  },
} as const;

/** Keeps standalone comparisons and grouped metric cards consistent for screen readers. */
export function describeKpiTrend(trend: KpiTrend) {
  const direction = TREND_PRESENTATION[trend.direction].description;
  const value = formatKpiTrend(trend);
  const description =
    trend.direction === "unchanged" ? value : `${direction}: ${value}`;
  return `${description} compared with the previous period`;
}

/** Presents an approved comparison with a decorative direction icon and wrapping period context. */
export default function TrendComparison({ trend }: { trend?: KpiTrend }) {
  if (!trend) return null;

  const presentation = TREND_PRESENTATION[trend.direction];

  return (
    <View
      accessible
      accessibilityLabel={describeKpiTrend(trend)}
      className="mt-2 min-w-0 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5"
    >
      {/* Keep the direction and value together without clipping large values. */}
      <View className="max-w-full min-w-0 flex-row items-center gap-1">
        <MaterialCommunityIcons
          name={presentation.icon}
          size={15}
          color={presentation.color}
          accessible={false}
        />
        <AppText
          weight="semibold"
          className={`min-w-0 shrink text-small leading-5 ${presentation.textClass}`}
          style={{ color: presentation.color }}
        >
          {trend.direction === "unchanged" ? "0" : formatKpiTrend(trend)}
        </AppText>
      </View>

      {/* Comparison context can wrap independently on narrow screens. */}
      <AppText
        weight="regular"
        className={`min-w-0 shrink text-small leading-5 ${presentation.textClass}`}
        style={{ color: presentation.color }}
      >
        vs prev
      </AppText>
    </View>
  );
}
