import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";
import type { PlusStoredInsightsReport } from "../../types/merchantAdvancedAnalytics.types";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";

function shortDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

const RULES = [
  {
    icon: "calendar-range",
    title: "Review dates",
    text: "This prepared summary uses its own review dates. Changing dates in other Analytics reports does not change this summary.",
  },
  {
    icon: "text-box-outline",
    title: "Summary and common mentions",
    text: "The summary is AI-generated from analyzed reviews. Mention counts describe those reviews, and do not automatically mean praise or complaints.",
  },
  {
    icon: "emoticon-outline",
    title: "Overall feedback",
    text: "The feedback label uses categorized reviews from its own reporting window. Its sample may differ from the reviews analyzed for the written summary.",
  },
] as const;

/** Presents stored review content with its own dates, clear freshness, and no generation actions. */
export default function AnalyticsStoredReviewInsights({
  report,
  loading = false,
  error,
  retry,
}: {
  report?: PlusStoredInsightsReport;
  loading?: boolean;
  error?: unknown;
  retry: () => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  const summary = report?.stored_summary;
  const pending = loading && !report;
  const unavailable = report?.meta.availability === "unavailable";
  const contentAvailable = !unavailable && summary?.content_available;
  const mentions = [...(summary?.frequent_mentions ?? [])].sort(
    (a, b) => b.count - a.count,
  );
  const start = shortDate(summary?.coverage_start ?? null);
  const end = shortDate(summary?.coverage_end ?? null);
  const prepared = shortDate(summary?.generated_at ?? null);
  const dateRange =
    start && end
      ? `Reviews from ${start.split(" ").at(-1) === end.split(" ").at(-1) ? start.replace(/\s\d{4}$/, "") : start} – ${end}`
      : "Review dates unavailable";

  return (
    <>
      <View className="gap-5">
        {/* Native navigation owns the page title; this header remains visible during loading. */}
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="min-w-0 flex-1 text-base text-text-primary"
            >
              Review summary
            </AppText>
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="Show review summary details"
              accessibilityHint="Opens review dates, sample information, and measurement explanations"
              onPress={() => sheetRef.current?.present()}
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
        </View>
        {Boolean(error) && (
          <ErrorState
            size="section"
            title={
              report
                ? "Unable to refresh review insights"
                : "Unable to load review insights"
            }
            description={
              report
                ? "Previously loaded information is still shown."
                : "Please try this report again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        )}
        {pending ? (
          <View
            accessibilityLabel="Loading review insights"
            accessibilityState={{ busy: true }}
            className="gap-4"
          >
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </View>
        ) : unavailable ? (
          !error && (
            <ErrorState
              size="section"
              title="Review insights unavailable"
              description="This report could not be loaded."
              primaryActionTitle="Retry"
              onPrimaryAction={retry}
            />
          )
        ) : summary ? (
          <>
            <View className="flex-row items-start gap-2">
              <MaterialCommunityIcons
                name="calendar-range"
                size={17}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />
              <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
                {dateRange}
              </AppText>
            </View>
            {summary.state === "outdated" && (
              <InfoBanner title="This summary needs updating">
                <AppText className="text-sm leading-5 text-text-secondary">
                  Recent changes may not be reflected in this summary.
                </AppText>
              </InfoBanner>
            )}
            {contentAvailable ? (
              <View className="gap-4 rounded-card  bg-surface-muted p-4">
                {/* Disclosure and the supported feedback label share the summary header. */}
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="flex-row items-center gap-1.5">
                    <MaterialCommunityIcons
                      name="creation"
                      size={13}
                      color={theme.extends.colors.text.tertiary}
                      accessible={false}
                    />
                    <AppText className="text-xs text-text-secondary">
                      AI-generated
                    </AppText>
                  </View>
                  {summary.has_sufficient_sentiment_data && (
                    <ReviewVibeBadge vibe={summary.overall_vibe} />
                  )}
                </View>
                {summary.narrative ? (
                  <View className="gap-2">
                    <AppText className="text-base leading-6 text-text-primary">
                      {summary.narrative}
                    </AppText>
                  </View>
                ) : (
                  <AppText className="text-sm text-text-secondary">
                    No written summary is available.
                  </AppText>
                )}
                <View className="flex-row items-start gap-1.5 border-t border-border-primary pt-3">
                  <AppText className="text-xs leading-5 text-text-secondary">
                    Based on {summary.analyzed_review_count}{" "}
                    {summary.analyzed_review_count === 1 ? "review" : "reviews"}
                    {summary.is_sampled ? " · Sampled" : ""}
                  </AppText>
                </View>
              </View>
            ) : (
              <AnalyticsChartEmptyState
                compact
                icon="comment-text-outline"
                title={
                  summary.state === "pending"
                    ? "Insights are being prepared"
                    : summary.state === "insufficient_reviews"
                      ? "More reviews are needed"
                      : "Review summary unavailable"
                }
                description={
                  summary.state === "insufficient_reviews"
                    ? `At least ${summary.minimum_eligible_review_count} qualifying reviews are needed.`
                    : "A prepared summary is not available yet."
                }
              />
            )}
          </>
        ) : (
          !error && (
            <AnalyticsChartEmptyState
              compact
              title="No review summary yet"
              description="A review summary has not been prepared for your business."
              icon="comment-text-outline"
            />
          )
        )}

        {/* Ranked labels retain exact counts without inventing praise/complaint categories. */}
        {(pending || contentAvailable) && (
          <View className="gap-3 border-t border-border-primary/60 pt-5">
            <View className="flex-row flex-wrap items-center justify-between gap-x-3">
              <AppText weight="bold" className="text-base text-text-primary">
                Commonly mentioned
                {contentAvailable && (
                  <AppText
                    weight="medium"
                    className="text-sm text-text-primary"
                  >
                    {" "}
                    ({mentions.length})
                  </AppText>
                )}
              </AppText>
              {contentAvailable && (
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="View all merchant reviews"
                  accessibilityHint="Opens Reviews with all reviews selected, newest first"
                  onPress={() =>
                    router.push({
                      pathname: "/(merchant)/(tabs)/reviews",
                      params: {
                        filter: "all",
                        ordering: "newest",
                        reviewIntent: String(Date.now()),
                      },
                    })
                  }
                  className="min-h-11 cursor-pointer flex-row items-center gap-1 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-brand">
                    View reviews
                  </AppText>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={17}
                    color={theme.extends.colors.brand}
                    accessible={false}
                  />
                </SafePressable>
              )}
            </View>
            {pending ? (
              <View className="gap-4">
                <Skeleton className="h-6 w-full rounded" />
                <Skeleton className="h-6 w-full rounded" />
              </View>
            ) : mentions.length ? (
              mentions.map((mention, index) => (
                <View
                  key={`${mention.label}-${index}`}
                  accessible
                  accessibilityLabel={`${mention.label}: ${mention.count} ${mention.count === 1 ? "review" : "reviews"}`}
                  className={`min-h-12 flex-row items-center justify-between gap-4 py-2 ${index > 0 ? "border-t border-border-primary/60" : ""}`}
                >
                  <AppText
                    weight="medium"
                    className="min-w-0 flex-1 text-sm leading-5 text-text-primary"
                  >
                    {mention.label}
                  </AppText>
                  <AppText className="shrink text-sm tabular-nums text-text-secondary">
                    <AppText weight="semibold" className="text-text-primary">
                      {mention.count}
                    </AppText>{" "}
                    {mention.count === 1 ? "review" : "reviews"}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText className="text-sm text-text-secondary">
                No common mentions are available yet.
              </AppText>
            )}
          </View>
        )}
      </View>

      {/* Measurement explanations stay mounted and use the established neutral-icon sheet. */}
      <AnalyticsReportSheet
        sheetRef={sheetRef}
        title="About review insights"
        description="A prepared summary with its own review dates."
        closeLabel="Close review summary information"
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
          {summary && (
            <View className="gap-2 border-t border-border-primary/60 pt-4">
              <AppText weight="semibold" className="text-sm text-text-primary">
                Coverage and freshness
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {dateRange}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {prepared
                  ? `Prepared ${prepared}`
                  : "Preparation date unavailable"}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                Based on {summary.analyzed_review_count} of{" "}
                {summary.eligible_review_count} reviews that qualified for
                analysis.
                {summary.is_sampled ? " Only a sample was analyzed." : ""}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {summary.classified_review_count} reviews are categorized for
                the feedback label.
              </AppText>
              {summary.policy.generation_rules_match === false && (
                <AppText className="text-sm leading-6 text-text-secondary">
                  Review criteria have changed since this summary was prepared.
                </AppText>
              )}
              {summary.policy.generation_rules_match === null && (
                <AppText className="text-sm leading-6 text-text-secondary">
                  The original review criteria could not be verified.
                </AppText>
              )}
              {summary.state_message && (
                <AppText className="text-sm leading-6 text-text-secondary">
                  {summary.state_message}
                </AppText>
              )}
            </View>
          )}
          {report && (
            <AppText className="text-sm leading-6 text-text-secondary">
              {report.measurement_note}
            </AppText>
          )}
        </View>
      </AnalyticsReportSheet>
    </>
  );
}
