import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";
import type { KpiTrend } from "../utils/merchantKpiComparisons.utils";
import TrendComparison, { describeKpiTrend } from "./analytics/TrendComparison";
type MetricIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type MetricCardProps = {
  icon: MetricIconName;
  label: string;
  value: string;
  detail?: string;
  accessibilityDetail?: string;
  unavailable?: boolean;
  stacked: boolean;
  trend?: KpiTrend;
  progress?: number | null;
  fullWidth?: boolean;
  loading?: boolean;
  loadingDetail?: boolean;
};

/**
 * Displays a business KPI with a subtle right-aligned icon,
 * supporting context, optional progress, and period comparison.
 */
export default function MerchantMetricCard({
  icon,
  label,
  value,
  detail,
  accessibilityDetail,
  unavailable,
  stacked,
  trend,
  progress,
  fullWidth = false,
  loading = false,
  loadingDetail = false,
}: MetricCardProps) {
  const showProgress =
    typeof progress === "number" &&
    Number.isFinite(progress) &&
    progress >= 0 &&
    progress <= 100;

  const accessibilityDescription = [
    `${label}: ${loading ? "Loading" : unavailable ? "Unavailable" : value}`,
    accessibilityDetail ?? detail,
    trend ? describeKpiTrend(trend) : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      accessible
      testID={fullWidth ? "analytics-reply-card" : undefined}
      accessibilityLabel={accessibilityDescription}
      accessibilityState={{ busy: loading }}
      className={`min-w-0 rounded-card bg-surface-muted p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
    >
      {/* Metric heading and right-aligned icon */}
      <View className="flex-row items-start justify-between gap-2">
        <AppText
          weight="medium"
          className="min-w-0 flex-1 text-sm leading-5 text-text-secondary"
        >
          {label}
        </AppText>

        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      </View>

      {/* Primary value and supporting count */}
      <View className="mt-2 gap-1">
        {loading ? (
          <Skeleton className="h-9 w-20 rounded" />
        ) : (
          <AppText
            weight="semibold"
            className={`${
              value.length > 7 && !stacked ? "text-2xl" : "text-3xl"
            } ${unavailable ? "text-text-secondary" : "text-text-primary"}`}
          >
            {value}
          </AppText>
        )}
        {loadingDetail && loading && <Skeleton className="h-4 w-28 rounded" />}
        {detail && (
          <AppText className="text-sm leading-5 text-text-secondary">
            {detail}
          </AppText>
        )}
      </View>

      {/* Reply-rate progress */}
      {loading && fullWidth && (
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      )}
      {!loading && showProgress && (
        <View
          testID="analytics-reply-progress"
          accessible={false}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted-strong"
        >
          <View
            testID="analytics-reply-progress-fill"
            className="h-full rounded-full bg-brand"
            style={{ width: `${progress}%` }}
          />
        </View>
      )}

      {/* Previous-period comparison */}
      {!loading && trend && <TrendComparison trend={trend} />}
    </View>
  );
}
