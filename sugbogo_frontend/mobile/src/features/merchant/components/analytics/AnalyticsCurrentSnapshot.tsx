import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";

type Props = {
  report: MerchantStandardAnalytics;
  onRetry: () => void;
};

/** Keeps current Pocket holders and published reviews outside period-filtered activity. */
export default function AnalyticsCurrentSnapshot({ report, onRetry }: Props) {
  if (report.sources.domain.availability === "unavailable") {
    return (
      <ErrorState
        size="section"
        title="Current business counts unavailable"
        description="Your current business counts couldn't be loaded."
        primaryActionTitle="Retry"
        onPrimaryAction={onRetry}
      />
    );
  }

  const rows = [
    {
      label: "Accounts with your business in a Pocket",
      value: report.current_pocket_holders,
      icon: "bookmark-outline" as const,
    },
    {
      label: "Published reviews",
      value: report.reviews.current_published_total,
      icon: "comment-text-outline" as const,
    },
  ];

  return (
    <View>
      {/* Current retained business counts */}
      {rows.map((row, index) => (
        <View
          key={row.label}
          accessible
          accessibilityLabel={`${row.label}: ${formatAnalyticsCount(row.value)}`}
          className={`flex-row flex-wrap items-center justify-between gap-3 py-3 ${
            index === 0 ? "border-b border-border-primary" : ""
          }`}
        >
          <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10">
            <MaterialCommunityIcons
              accessible={false}
              name={row.icon}
              size={20}
              color={theme.extends.colors.brand}
            />
          </View>
          <AppText
            weight="medium"
            className="min-w-0 flex-1 text-sm leading-5 text-text-primary"
          >
            {row.label}
          </AppText>
          <AppText weight="bold" className="text-xl text-text-primary">
            {formatAnalyticsCount(row.value)}
          </AppText>
        </View>
      ))}
      <AppText className="mt-3 text-xs leading-5 text-text-secondary">
        As of {formatAnalyticsTimestamp(report.snapshot_as_of)} · Manila time.
        Current totals are not affected by the selected dates.
      </AppText>
    </View>
  );
}
