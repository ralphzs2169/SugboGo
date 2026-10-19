import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import type {
  PeerMetric,
  PlusPeerReport,
} from "../../types/merchantAdvancedAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsHeaderControls from "./AnalyticsHeaderControls";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

const METRICS = [
  {
    key: "profile_visits",
    label: "Recorded profile visits",
    icon: "eye-outline",
  },
  { key: "saves", label: "Recorded saves", icon: "bookmark-outline" },
  {
    key: "specialty_support",
    label: "Specialty vouches added",
    icon: "thumb-up-outline",
  },
  {
    key: "positive_review_share",
    label: "Positive feedback",
    icon: "emoticon-happy-outline",
  },
] as const;
const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];
const REASONS: Record<string, string> = {
  merchant_sentiment_sample_too_small:
    "More reviews with feedback labels are needed for your business.",
  peer_sentiment_sample_too_small:
    "More similar businesses need enough reviews with feedback labels.",
  peer_group_too_small:
    "More qualifying businesses are needed for an anonymous comparison.",
};
const RULES = [
  {
    icon: "store-outline",
    title: "Similar businesses",
    text: "Other active businesses in your category are used first. A broader business group is used when the category is too small. Individual businesses are not identified.",
  },
  {
    icon: "scale-balance",
    title: "The middle value",
    text: "The comparison uses the median, or middle value, not the combined total. For example, counts of 40, 65, 94, 120, and 180 give a middle value of 94. With an even number of businesses, the two middle values are averaged. This is context, not a ranking. Businesses may have been listed for different lengths of time.",
  },
  {
    icon: "eye-outline",
    title: "Recorded activity",
    text: "Profile visits and saves describe recorded observations. Tracking may be incomplete. Saves are not current Pocket holders, and profile visits are not physical arrivals.",
  },
  {
    icon: "thumb-up-outline",
    title: "Specialty vouches",
    text: "Counts vouches added during the selected dates that remain valid on active specialties today. It is not current total support or net growth.",
  },
  {
    icon: "emoticon-outline",
    title: "Positive feedback",
    text: "Compares each business’s positive share of categorized published reviews created during these dates. Reviews without a category are excluded. Each business must meet the review sample requirement.",
  },
] as const;

function validValue(value: number | null, percent: boolean) {
  return (
    value !== null &&
    Number.isFinite(value) &&
    value >= 0 &&
    (!percent || value <= 100)
  );
}

/** Compares anonymous backend medians with exact paired bars, preserving suppression and source failures. */
export default function AnalyticsPeerComparisons({
  report,
  retry,
  period = "30",
  onPeriodChange,
  loading = false,
  error,
}: {
  report?: PlusPeerReport;
  retry: () => void;
  period?: MerchantAnalyticsPeriod;
  onPeriodChange?: (period: MerchantAnalyticsPeriod) => void;
  loading?: boolean;
  error?: unknown;
}) {
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const informationRef = useRef<BottomSheetModal>(null);
  const pending = loading && !report;
  const insufficient =
    report &&
    (report.status === "insufficient_data" ||
      report.group.size < report.group.minimum_size);
  const unavailable = report?.meta.availability === "unavailable";

  return (
    <>
      {/* Stable controls and concise anonymous group context. */}
      <View className="gap-5">
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="min-w-0 flex-1 text-base text-text-primary"
            >
              Business comparison
            </AppText>
            <AnalyticsHeaderControls
              period={period}
              onOpenPeriod={() => periodSheetRef.current?.present()}
              onOpenInformation={() => informationRef.current?.present()}
              informationLabel="About peer comparisons"
              informationHint="Explains comparison groups, middle values, and measurement limits"
            />
          </View>
        </View>
        {pending ? (
          <View className="gap-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-52 max-w-full rounded" />
          </View>
        ) : (
          report &&
          !insufficient &&
          !unavailable && (
            <View className="flex-row items-start gap-3 rounded-xl bg-surface-muted px-3 py-3">
              <MaterialCommunityIcons
                name="store-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
              <View className="min-w-0 flex-1 gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {report.group.size} similar businesses
                </AppText>
                <AppText className="text-xs leading-5 text-text-secondary">
                  The comparison shows the group&apos;s middle value.
                </AppText>
              </View>
            </View>
          )
        )}
        {Boolean(error) && (
          <ErrorState
            variant="analytics"
            title={
              report
                ? "Unable to refresh comparisons"
                : "Unable to load comparisons"
            }
            description={
              report
                ? "Previously loaded comparisons are still shown."
                : "Please try this report again."
            }
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
        ) : unavailable ? (
          !error && (
            <ErrorState
              variant="analytics"
              title="Peer comparisons unavailable"
              description="Comparison data could not be loaded."
              primaryActionTitle="Retry"
              onPrimaryAction={retry}
            />
          )
        ) : (
          (pending || report) && (
            <View>
              {/* Each metric has its own scale; percentages always use 0–100. */}
              {METRICS.map(({ key, label, icon }) => {
                const metric: PeerMetric | undefined = report?.metrics[key];
                const percent = metric?.unit === "percent";
                const supported =
                  metric && ["available", "partial"].includes(metric.status);
                const failed = metric?.status === "unavailable";
                const maximum = percent
                  ? 100
                  : Math.max(
                      1,
                      metric?.merchant_value ?? 0,
                      metric?.peer_median ?? 0,
                    );
                return (
                  <View
                    key={key}
                    className="gap-5 border-t border-border-primary/60 py-5"
                  >
                    <View className="flex-row items-center gap-2">
                      <AppText
                        weight="bold"
                        className="min-w-0 flex-1 text-base text-text-primary"
                      >
                        {label}
                      </AppText>
                      <MaterialCommunityIcons
                        name={icon}
                        size={20}
                        color={theme.extends.colors.text.secondary}
                        accessible={false}
                      />
                    </View>
                    {pending ? (
                      <View className="gap-4">
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-2 w-full rounded-full" />
                      </View>
                    ) : supported && metric ? (
                      <View
                        testID={`analytics-peer-pair-${key}`}
                        className="gap-4"
                      >
                        {[
                          {
                            id: "merchant",
                            label: "Your business",
                            value: metric.merchant_value,
                            color: "bg-brand",
                          },
                          {
                            id: "peer",
                            label: "Similar businesses · Middle value",
                            value: metric.peer_median,
                            color: "bg-slate-500",
                          },
                        ].map((row) => {
                          const valid = validValue(row.value, percent);
                          const text = valid
                            ? `${row.value!.toLocaleString("en-PH", { maximumFractionDigits: 2 })}${percent ? "%" : ""}`
                            : "Unavailable";
                          return (
                            <View
                              key={row.id}
                              accessible
                              accessibilityLabel={`${label}, ${row.id === "merchant" ? "your business" : "similar businesses: median"}: ${text}`}
                              className="gap-2"
                            >
                              <View className="flex-row flex-wrap items-center justify-between gap-2">
                                <AppText className="text-sm text-text-secondary">
                                  {row.label}
                                </AppText>
                                <AppText
                                  weight="semibold"
                                  className="text-base tabular-nums text-text-primary"
                                >
                                  {text}
                                </AppText>
                              </View>
                              {valid && (
                                <View
                                  accessible={false}
                                  className="h-2 overflow-hidden rounded-full bg-surface-muted"
                                >
                                  <View
                                    testID={`peer-bar-${key}-${row.id}`}
                                    className={`h-full rounded-full ${row.color}`}
                                    style={{
                                      width: `${Math.min(100, (row.value! / maximum) * 100)}%`,
                                    }}
                                  />
                                </View>
                              )}
                            </View>
                          );
                        })}
                        {metric.eligible_peer_sample_size != null &&
                          metric.eligible_peer_sample_size !==
                            report?.group.size && (
                            <AppText className="text-xs text-text-secondary">
                              Based on {metric.eligible_peer_sample_size}{" "}
                              qualifying businesses
                            </AppText>
                          )}
                      </View>
                    ) : failed ? (
                      <ErrorState
                        variant="analytics"
                        title={`${label} unavailable`}
                        description="Other available comparisons are still shown."
                        primaryActionTitle="Retry"
                        onPrimaryAction={retry}
                      />
                    ) : (
                      <AnalyticsChartEmptyState
                        compact
                        icon="chart-box-outline"
                        title="Not enough data to compare yet"
                        description={
                          REASONS[metric?.reason ?? ""] ??
                          "More eligible activity is needed for this comparison."
                        }
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )
        )}
      </View>
      {/* Measurement details are available during loading and never imply a competitive score. */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            onPeriodChange?.(value);
        }}
        snapPoints={["50%"]}
      />
      <AnalyticsReportSheet
        sheetRef={informationRef}
        title="About peer comparisons"
        description="Understand the anonymous comparison."
        closeLabel="Close peer comparison information"
      >
        <View className="gap-5">
          {RULES.map((rule, index) => (
            <View
              key={rule.title}
              className={`flex-row items-start gap-3 ${index ? "border-t border-border-primary/60 pt-4" : ""}`}
            >
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                <MaterialCommunityIcons
                  name={rule.icon}
                  size={19}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {rule.title}
                </AppText>
                <AppText className="text-sm leading-6 text-text-secondary">
                  {rule.text}
                </AppText>
              </View>
            </View>
          ))}
          {report && (
            <View className="gap-3 border-t border-border-primary/60 pt-4">
              <AppText className="text-sm leading-6 text-text-secondary">
                At least {report.group.minimum_size} other qualifying businesses
                are required. Your business is excluded.
                {report.group.fallback_reason === "category_group_too_small"
                  ? " This category has too few businesses, so a broader business group is used."
                  : ""}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                Positive feedback requires at least{" "}
                {report.group.positive_share_min_classified_reviews} categorized
                reviews per business.
              </AppText>
              <PlusReportContext
                meta={report.meta}
                note="Recorded activity may be incomplete. Review labels and retained vouches can change after the original activity. Peer business lifetimes are not normalized."
              />
            </View>
          )}
        </View>
      </AnalyticsReportSheet>
    </>
  );
}
