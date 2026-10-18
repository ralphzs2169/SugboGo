import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View, useWindowDimensions } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

/** Soft, low-contrast elevation shared by the metric cards. */
const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  unavailable?: boolean;
  stacked: boolean;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

/** Presents one metric and its denominator or measurement context as a readable unit. */
function MetricCard({
  label,
  value,
  detail,
  unavailable,
  stacked,
  icon,
}: MetricCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${unavailable ? "Unavailable" : value}. ${detail}`}
      className={`min-w-0 rounded-card border border-border-primary/60 bg-surface p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
      style={CARD_SHADOW}
    >
      {/* Metric identity: small icon beside the label, no background tile */}
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          accessible={false}
          name={icon}
          size={18}
          color={theme.extends.colors.brand}
        />
        <AppText
          weight="medium"
          className="min-w-0 flex-1 text-sm text-text-secondary"
          numberOfLines={2}
        >
          {label}
        </AppText>
      </View>

      {/* Hero value, muted when the source is unavailable */}
      <AppText
        weight="semibold"
        className={`mt-3 text-3xl ${
          unavailable ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {value}
      </AppText>

      {/* Measurement context */}
      <AppText className="mt-1 text-xs leading-4 text-text-secondary">
        {detail}
      </AppText>
    </View>
  );
}

/** Shows period activity without treating missing tracking or empty cohorts as zero. */
export default function AnalyticsActivityOverview({
  report,
}: {
  report: MerchantStandardAnalytics;
}) {
  const { fontScale, width } = useWindowDimensions();
  const useSingleColumn = fontScale >= 1.5 || width < 340;
  const visibilityAvailable =
    report.sources.visibility.availability !== "unavailable";
  const domainAvailable = report.sources.domain.availability !== "unavailable";
  const visits = visibilityAvailable ? report.profile_visits : null;
  const visitors = visibilityAvailable
    ? report.distinct_profile_visitors
    : null;
  const saves = visibilityAvailable ? report.saves_in_period : null;
  const reviews = report.reviews;
  const replyRate = domainAvailable ? reviews.reply_rate : null;
  let replyDetail = "Reply percentage unavailable";

  if (domainAvailable && reviews.period_eligible_published === 0) {
    replyDetail = "No published reviews from these dates";
  } else if (domainAvailable) {
    replyDetail = `${formatAnalyticsCount(reviews.period_replied_published)} of ${formatAnalyticsCount(reviews.period_eligible_published)} published reviews replied to`;
  }

  const rowClassName = useSingleColumn ? "gap-3" : "flex-row gap-3";

  return (
    <View className="gap-3">
      {/* Visibility and expressed interest */}
      <View className={rowClassName}>
        <MetricCard
          icon="eye-outline"
          stacked={useSingleColumn}
          label="Recorded profile visits"
          value={formatAnalyticsCount(visits)}
          unavailable={visits === null}
          detail={
            visitors === null
              ? "Visitor accounts unavailable"
              : `${formatAnalyticsCount(visitors)} visitor accounts`
          }
        />
        <MetricCard
          icon="bookmark-outline"
          stacked={useSingleColumn}
          label="Recorded saves"
          value={formatAnalyticsCount(saves)}
          unavailable={saves === null}
          detail={
            saves === null
              ? "Save activity unavailable"
              : "Recorded in this period"
          }
        />
      </View>

      {/* Published review creation cohort and backend reply rate */}
      <View className={rowClassName}>
        <MetricCard
          icon="comment-text-outline"
          stacked={useSingleColumn}
          label="New reviews"
          value={formatAnalyticsCount(
            domainAvailable ? reviews.new_published_in_period : null,
          )}
          unavailable={!domainAvailable}
          detail="Added during these dates and still published"
        />
        <MetricCard
          stacked={useSingleColumn}
          label="Reviews replied to"
          value={replyRate === null ? "—" : `${replyRate}%`}
          unavailable={replyRate === null}
          detail={replyDetail}
        />
      </View>
    </View>
  );
}
