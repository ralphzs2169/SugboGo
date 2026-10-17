import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View, useWindowDimensions } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

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
      className={`min-w-0 rounded-card border border-border-primary/60 bg-background p-4 ${
        stacked ? "w-full" : "flex-1"
      }`}
    >
      {/* Metric identity and value */}
      <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl bg-brand/10">
        <MaterialCommunityIcons
          accessible={false}
          name={icon}
          size={20}
          color={theme.extends.colors.brand}
        />
      </View>
      <AppText weight="semibold" className="text-sm text-text-primary">
        {label}
      </AppText>
      <AppText weight="extrabold" className="mt-3 text-3xl text-text-primary">
        {value}
      </AppText>
      <AppText className="mt-2 text-sm leading-5 text-text-secondary">
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
  let replyDetail = "Reply rate unavailable";

  if (domainAvailable && reviews.period_eligible_published === 0) {
    replyDetail = "No eligible reviews in this period";
  } else if (domainAvailable) {
    replyDetail = `${formatAnalyticsCount(reviews.period_replied_published)} of ${formatAnalyticsCount(reviews.period_eligible_published)} eligible reviews replied to`;
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
              ? "Distinct visitors unavailable"
              : `${formatAnalyticsCount(visitors)} distinct visitors`
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
          detail="Created in this period and currently published"
        />
        <MetricCard
          icon="message-check-outline"
          stacked={useSingleColumn}
          label="Reply rate"
          value={replyRate === null ? "—" : `${replyRate}%`}
          unavailable={replyRate === null}
          detail={replyDetail}
        />
      </View>
    </View>
  );
}
