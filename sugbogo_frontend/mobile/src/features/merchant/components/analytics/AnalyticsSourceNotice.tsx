import ErrorState from "@/shared/components/ErrorState";

import type { MerchantStandardAnalytics } from "../../types/merchantAnalytics.types";

type Props = {
  report: MerchantStandardAnalytics;
  onRetry: () => void;
};

/**
 * Displays persistent recovery when recorded analytics are unavailable.
 * Keeps successful metrics visible instead of hiding the whole report.
 */
export default function AnalyticsSourceNotice({ report, onRetry }: Props) {
  const visibility = report.sources.visibility;

  const hasUnavailableMetrics =
    visibility.availability === "unavailable" ||
    report.profile_visits === null ||
    report.distinct_profile_visitors === null ||
    report.saves_in_period === null;

  if (!hasUnavailableMetrics) {
    return null;
  }

  return (
    <ErrorState
      variant="analytics"
      title={
        visibility.availability === "unavailable"
          ? "Recorded activity unavailable"
          : "Some activity is unavailable"
      }
      description="Some numbers couldn't be loaded. Available metrics are still shown."
      primaryActionTitle="Retry"
      onPrimaryAction={onRetry}
    />
  );
}
