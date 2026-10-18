import { useState } from "react";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";
import type { PlusStoredInsightsReport } from "../../types/merchantAdvancedAnalytics.types";
import { formatOptionalAnalyticsTimestamp as formatAnalyticsTimestamp } from "../../utils/merchantPlusAnalytics.utils";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";

/**
 * Presents the existing review summary and mentions before supporting report details.
 * Its own coverage window, outdated warning and server content gate are preserved.
 */
export default function AnalyticsStoredReviewInsights({
  report,
}: {
  report: PlusStoredInsightsReport;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = report.stored_summary;
  const mentions = [...(summary?.frequent_mentions ?? [])].sort(
    (a, b) => b.count - a.count,
  );

  return (
    <View className="gap-5">
      {summary ? (
        <>
          {/* Summary identity and freshness come before the narrative. */}
          <AppText weight="semibold" className="text-base text-text-primary">
            {summary.state === "outdated"
              ? "Review summary · needs updating"
              : "Review summary"}
          </AppText>
          {summary.state === "outdated" && (
            <InfoBanner title="This summary needs updating">
              <AppText className="text-sm leading-5 text-text-secondary">
                {summary.state_message ??
                  "The reviews or review rules have changed since this summary was prepared."}
              </AppText>
            </InfoBanner>
          )}
          {summary.content_available ? (
            <>
              {summary.narrative && (
                <AppText className="text-base leading-6 text-text-primary">
                  {summary.narrative}
                </AppText>
              )}

              {/* Mention counts describe analyzed reviews without implying praise or complaints. */}
              <View className="gap-3 border-t border-border-primary pt-4">
                <AppText weight="bold" className="text-base text-text-primary">
                  Frequent mentions
                </AppText>
                {mentions.length ? (
                  mentions.map((mention, index) => (
                    <View
                      key={`${mention.label}-${index}`}
                      className="min-h-12 flex-row items-center gap-3 border-b border-border-primary py-2"
                    >
                      <AppText className="text-sm text-text-secondary">
                        {index + 1}
                      </AppText>
                      <AppText className="min-w-0 flex-1 text-base text-text-primary">
                        {mention.label}
                      </AppText>
                      <AppText
                        weight="semibold"
                        className="text-sm text-text-secondary"
                      >
                        {mention.count} reviews
                      </AppText>
                    </View>
                  ))
                ) : (
                  <AppText className="text-sm text-text-secondary">
                    No common mentions are available yet.
                  </AppText>
                )}
                <AppText className="text-sm leading-5 text-text-secondary">
                  Mentions come from the analyzed reviews. They do not
                  automatically mean praise or complaints.
                </AppText>
              </View>
            </>
          ) : (
            <AnalyticsChartEmptyState
              title={
                summary.state === "pending"
                  ? "Insights are being prepared"
                  : "Review summary unavailable"
              }
              description={
                summary.state_message ??
                "A review summary cannot currently be shown. Review Performance is available as a separate report."
              }
              icon="comment-text-outline"
            />
          )}

          {/* Coverage belongs to this summary, independent of dashboard dates. */}
          <View className="gap-2">
            <AppText className="text-sm leading-5 text-text-secondary">
              Review dates: {formatAnalyticsTimestamp(summary.coverage_start)} –{" "}
              {formatAnalyticsTimestamp(summary.coverage_end)} · Manila time.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Based on {summary.analyzed_review_count} of{" "}
              {summary.eligible_review_count} reviews that qualified for
              analysis.
              {summary.is_sampled
                ? " Only a sample of those reviews was analyzed."
                : ""}
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Prepared {formatAnalyticsTimestamp(summary.generated_at)} · Manila
              time.
            </AppText>
          </View>
        </>
      ) : (
        <AnalyticsChartEmptyState
          title="No review summary yet"
          description="A review summary has not been prepared for your business."
          icon="comment-text-outline"
        />
      )}

      {/* Keep free-form explanations available without rewriting server messages. */}
      <View className="gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? "Hide review summary details"
              : "Show review summary details"
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          className="min-h-12 cursor-pointer justify-center self-start py-2 active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-text-info">
            {expanded ? "Hide summary details" : "About this summary"}
          </AppText>
        </Pressable>
        {expanded && (
          <View className="gap-2 border-t border-border-primary pt-3">
            <AppText className="text-sm leading-5 text-text-secondary">
              {report.measurement_note}
            </AppText>
            {summary && (
              <>
                <AppText className="text-sm leading-5 text-text-secondary">
                  At least {summary.minimum_eligible_review_count} qualifying
                  reviews are needed for a summary.{" "}
                  {summary.classified_review_count} reviews have a sentiment
                  label.
                </AppText>
                <AppText className="text-sm leading-5 text-text-secondary">
                  Last updated {formatAnalyticsTimestamp(summary.updated_at)} ·
                  Manila time.
                </AppText>
                {summary.policy.generation_rules_match === false && (
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Review criteria have changed since this summary was
                    prepared.
                  </AppText>
                )}
                {summary.policy.generation_rules_match === null && (
                  <AppText className="text-sm leading-5 text-text-secondary">
                    The original review criteria could not be verified.
                  </AppText>
                )}
                {summary.state_message &&
                  summary.state !== "outdated" &&
                  summary.content_available && (
                    <AppText className="text-sm leading-5 text-text-secondary">
                      {summary.state_message}
                    </AppText>
                  )}
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
