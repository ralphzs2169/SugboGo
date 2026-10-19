import { View, useWindowDimensions } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type {
  PeerMetric,
  PlusPeerReport,
} from "../../types/merchantAdvancedAnalytics.types";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsDetailContext from "./AnalyticsDetailContext";

const REASONS: Record<string, string> = {
  peer_group_too_small:
    "There are too few qualifying businesses for an anonymous comparison.",
  merchant_sentiment_sample_too_small:
    "Your business needs more reviews with a sentiment label for this comparison.",
  peer_sentiment_sample_too_small:
    "Too few similar businesses have enough reviews with a sentiment label.",
  visibility_unavailable: "Recorded visibility data is currently unavailable.",
};

const METRIC_LABELS: Record<string, string> = {
  profile_visits: "Recorded profile visits",
  saves: "Recorded saves",
  specialty_support: "Vouches added that still count",
  positive_review_share: "Positive reviews (%)",
};

function metricValue(value: number | null, metric: PeerMetric) {
  return value === null
    ? "Unavailable"
    : `${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}${metric.unit === "percent" ? "%" : ""}`;
}

/** Leads with anonymous comparisons and discloses group definitions below the values. */
export default function AnalyticsPeerComparisons({
  report,
  retry,
}: {
  report: PlusPeerReport;
  retry: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 340 || fontScale >= 1.5;
  const insufficient =
    report.status === "insufficient_data" ||
    report.group.size < report.group.minimum_size;
  return (
    <View className="gap-5">
      {/* The group is anonymous and excludes the merchant's own business. */}
      <AppText className="text-sm leading-5 text-text-secondary">
        Compared with {report.group.size} other active businesses in the same{" "}
        {report.group.scope === "category"
          ? "category"
          : "broader business group"}
        . Individual businesses are not identified.
      </AppText>
      {!insufficient &&
        Object.values(report.metrics).some(
          (metric) => metric.status === "unavailable",
        ) && (
          <ErrorState
            size="section"
            title="Some peer comparisons unavailable"
            description="Some figures could not be loaded. Available comparisons are shown."
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}
      {insufficient ? (
        <AnalyticsChartEmptyState
          title="Not enough comparable businesses yet"
          description="More qualifying businesses are needed before an anonymous comparison can be shown."
          icon="store-outline"
        />
      ) : (
        <View>
          {/* Compact paired values preserve each metric's own sample and source status. */}
          {Object.entries(report.metrics).map(([key, metric]) => {
            const label = METRIC_LABELS[key] ?? metric.label;
            const supported =
              metric.status === "available" || metric.status === "partial";
            return (
              <View
                key={key}
                className="gap-2 border-b border-border-primary py-4"
              >
                <AppText
                  weight="semibold"
                  className="text-base text-text-primary"
                >
                  {label}
                </AppText>
                {supported ? (
                  <>
                    <View
                      testID={`analytics-peer-pair-${key}`}
                      className={stacked ? "gap-3" : "flex-row gap-4"}
                    >
                      <View className="flex-1">
                        <AppText className="text-sm text-text-secondary">
                          Your business
                        </AppText>
                        <AppText
                          accessibilityLabel={`${label}, your business: ${metricValue(metric.merchant_value, metric)}`}
                          weight="bold"
                          className="mt-1 text-2xl tabular-nums text-text-primary"
                        >
                          {metricValue(metric.merchant_value, metric)}
                        </AppText>
                      </View>
                      <View className="flex-1">
                        <AppText className="text-sm text-text-secondary">
                          Similar businesses: median
                        </AppText>
                        <AppText
                          accessibilityLabel={`${label}, similar businesses: median: ${metricValue(metric.peer_median, metric)}`}
                          weight="bold"
                          className="mt-1 text-2xl tabular-nums text-text-primary"
                        >
                          {metricValue(metric.peer_median, metric)}
                        </AppText>
                      </View>
                    </View>
                    {metric.position &&
                      metric.merchant_value !== null &&
                      metric.peer_median !== null && (
                        <AppText className="text-sm text-text-secondary">
                          {metric.position === "above_median"
                            ? "Above"
                            : metric.position === "below_median"
                              ? "Below"
                              : "At"}{" "}
                          the comparison median ·{" "}
                          {metric.eligible_peer_sample_size ?? "Unavailable"}{" "}
                          qualifying businesses
                        </AppText>
                      )}
                    {metric.status === "partial" && (
                      <AppText className="text-sm leading-5 text-text-secondary">
                        Some activity may not be recorded.
                      </AppText>
                    )}
                    {key === "specialty_support" && (
                      <AppText className="text-sm leading-5 text-text-secondary">
                        Vouches added during these dates that still count for
                        active specialties. This is not the current support
                        total.
                      </AppText>
                    )}
                    {key === "positive_review_share" && (
                      <AppText className="text-sm leading-5 text-text-secondary">
                        Each business needs at least{" "}
                        {report.group.positive_share_min_classified_reviews}{" "}
                        published reviews with a sentiment label. Your labeled
                        reviews:{" "}
                        {metric.merchant_classified_review_count ??
                          "Unavailable"}
                        . Reviews without a sentiment label are excluded.
                      </AppText>
                    )}
                  </>
                ) : (
                  <AppText className="text-sm leading-5 text-text-secondary">
                    {REASONS[metric.reason ?? ""] ??
                      "A reliable comparison is not available for this metric."}
                  </AppText>
                )}
              </View>
            );
          })}
        </View>
      )}
      <AnalyticsDetailContext
        title="About peer comparisons"
        meta={report.meta}
        note="The median is the middle value when the businesses' values are ordered. Businesses may have been listed for different lengths of time, so this comparison is context, not a competitive ranking. Review labels and vouches that still count can change after the original activity."
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          An anonymous comparison needs at least {report.group.minimum_size}{" "}
          other qualifying businesses. Your business is excluded from that
          group.
          {report.group.fallback_reason === "category_group_too_small"
            ? " This category has too few businesses, so a broader business group is used."
            : ""}
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {report.group.eligibility}
        </AppText>
      </AnalyticsDetailContext>
    </View>
  );
}
