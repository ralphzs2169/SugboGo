import { View } from "react-native";
import SafePressable from "@/shared/components/SafePressable";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import type { ApiError } from "@/shared/types/apiResponse.types";
import type {
  PlusRecommendationsReport,
  RecommendationRefreshResult,
  RecommendationState,
} from "../../types/merchantAdvancedAnalytics.types";
import { formatAnalyticsDate } from "../../utils/merchantAnalytics.utils";
import { formatOptionalAnalyticsTimestamp as formatAnalyticsTimestamp } from "../../utils/merchantPlusAnalytics.utils";
import AnalyticsDetailContext from "./AnalyticsDetailContext";

const STATE_COPY: Record<
  RecommendationState,
  { title: string; description: string }
> = {
  not_requested: {
    title: "Recommendations not requested",
    description:
      "Choose Get recommendations for suggestions based on the available information for these dates.",
  },
  pending: {
    title: "Recommendations are queued",
    description:
      "Your request is waiting to be processed. Use Check status to see whether it is ready.",
  },
  running: {
    title: "Preparing recommendations",
    description:
      "Your recommendations are being prepared. Use Check status to see whether they are ready.",
  },
  ready: {
    title: "Recommendations ready",
    description:
      "These suggestions use the information available when they were prepared.",
  },
  insufficient_data: {
    title: "More information is needed for recommendations",
    description:
      "There is not enough suitable information to prepare recommendations. Any available findings and actions are shown above.",
  },
  failed: {
    title: "Unable to prepare recommendations",
    description:
      "Your request could not be completed. Check status before requesting an update.",
  },
  invalidated: {
    title: "Recommendations need updating",
    description:
      "The underlying information, access or reporting rules changed. Previous recommendations are hidden until an update is available.",
  },
};

/**
 * Leads with available advice and findings, followed by dates and request controls.
 * Generation, status checks and content eligibility retain their existing guards.
 */
export default function AnalyticsBusinessRecommendations({
  report,
  refreshResult,
  refreshError,
  requesting,
  checking,
  throttled,
  requestRefresh,
  checkStatus,
}: {
  report: PlusRecommendationsReport;
  refreshResult?: RecommendationRefreshResult;
  refreshError: unknown;
  requesting: boolean;
  checking: boolean;
  throttled: boolean;
  requestRefresh: () => void;
  checkStatus: () => void;
}) {
  const acknowledgementIsNewer =
    refreshResult && refreshResult.request_id !== report.request_id;
  const state = acknowledgementIsNewer ? refreshResult.state : report.state;
  const active = state === "pending" || state === "running";
  const copy = STATE_COPY[state] ?? {
    title: "Recommendation status unavailable",
    description: "Check status for the latest information about this request.",
  };
  const error = refreshError as Partial<ApiError> | null;
  const source = acknowledgementIsNewer
    ? refreshResult.source_period
    : report.source_period;
  const requestLabel =
    state === "not_requested"
      ? "Get recommendations"
      : "Update recommendations";

  return (
    <View className="gap-5">
      {/* Meaningful failures and outdated content remain explicit. */}
      {state === "invalidated" || state === "failed" ? (
        <InfoBanner title={copy.title}>
          <AppText className="text-sm leading-5 text-text-secondary">
            {copy.description}
          </AppText>
        </InfoBanner>
      ) : (
        <View className="gap-2">
          <AppText weight="semibold" className="text-base text-text-primary">
            {copy.title}
          </AppText>
          <AppText className="text-sm leading-5 text-text-secondary">
            {copy.description}
          </AppText>
        </View>
      )}

      {/* Only current, publishable recommendations are shown. */}
      {report.content_available &&
        report.state === "ready" &&
        !acknowledgementIsNewer && (
          <View className="gap-3">
            <AppText weight="bold" className="text-base text-text-primary">
              Recommendations
            </AppText>
            {report.ai_recommendations.map((item, index) => (
              <View
                key={`${item.action_code}-${index}`}
                className="gap-2 rounded-card border border-border-primary/60 bg-surface p-4"
              >
                <AppText className="text-base leading-6 text-text-primary">
                  {item.message}
                </AppText>
                {item.evidence_codes
                  .map((code) =>
                    report.key_findings.find(
                      (finding) => finding.code === code,
                    ),
                  )
                  .filter((finding) => finding !== undefined)
                  .map((finding, findingIndex) => (
                    <AppText
                      key={`${finding.code}-${findingIndex}`}
                      className="text-sm leading-5 text-text-secondary"
                    >
                      Based on: {finding.message}
                    </AppText>
                  ))}
              </View>
            ))}
          </View>
        )}

      {/* New requests do not relabel findings from the last report that was checked. */}
      {acknowledgementIsNewer && (
        <AppText className="text-sm leading-5 text-text-secondary">
          A newer request is being checked. The findings below are from the
          previous report; they do not describe the new request.
        </AppText>
      )}
      {[
        {
          title: "Key findings",
          items: report.key_findings,
        },
        {
          title: "Suggested actions",
          items: report.recommended_actions,
        },
      ].map(
        (section) =>
          section.items.length > 0 && (
            <View
              key={section.title}
              className="gap-3 border-t border-border-primary pt-4"
            >
              <AppText weight="bold" className="text-base text-text-primary">
                {section.title}
              </AppText>
              {section.items.map((item, index) => (
                <AppText
                  key={`${item.code}-${index}`}
                  className="text-sm leading-6 text-text-secondary"
                >
                  {item.message}
                </AppText>
              ))}
            </View>
          ),
      )}

      {/* Advice dates stay separate from request dates and the latest status check. */}
      <View className="gap-2">
        <AppText weight="semibold" className="text-sm text-text-primary">
          Reporting dates
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {report.source_period
            ? `${formatAnalyticsDate(report.source_period.start_date)} – ${formatAnalyticsDate(report.source_period.end_date)} · ${report.source_period.timezone}.`
            : `${formatAnalyticsDate(report.requested_selection.start_date)} – ${formatAnalyticsDate(report.requested_selection.end_date)} · Manila time.`}
        </AppText>
        {!acknowledgementIsNewer && report.source_period && (
          <AppText className="text-sm leading-5 text-text-secondary">
            Recommendation information captured{" "}
            {formatAnalyticsTimestamp(report.source_period.snapshot_as_of)} ·
            Manila time. Later activity is not included in those
            recommendations.
          </AppText>
        )}
        {!acknowledgementIsNewer && report.generated_at && (
          <AppText className="text-sm leading-5 text-text-secondary">
            Recommendations prepared{" "}
            {formatAnalyticsTimestamp(report.generated_at)} · Manila time.
          </AppText>
        )}
        <AppText className="text-sm leading-5 text-text-secondary">
          Findings checked {formatAnalyticsTimestamp(report.checked_at)} ·
          Manila time.
        </AppText>
        {acknowledgementIsNewer && source && (
          <AppText className="text-sm leading-5 text-text-secondary">
            New request: {formatAnalyticsDate(source.start_date)} –{" "}
            {formatAnalyticsDate(source.end_date)} · {source.timezone}.
            Information captured{" "}
            {formatAnalyticsTimestamp(source.snapshot_as_of)}.
          </AppText>
        )}
        {!acknowledgementIsNewer &&
          report.source_period &&
          !report.evidence_matches && (
            <AppText className="text-sm leading-5 text-text-secondary">
              The information used for the previous recommendations has changed.
            </AppText>
          )}
      </View>

      {refreshResult && (
        <AppText className="text-sm leading-5 text-text-secondary">
          {refreshResult.created
            ? "Your request was received."
            : "An existing request or result is available. Check status for the latest information."}
        </AppText>
      )}
      {error && (
        <ErrorState
          size="section"
          title={
            error.code === "RATE_LIMIT_EXCEEDED"
              ? "Update limit reached"
              : error.code === "RECOMMENDATION_REFRESH_IN_PROGRESS"
                ? "Another request is in progress"
                : "Unable to request recommendations"
          }
          description={
            error.code === "RATE_LIMIT_EXCEEDED"
              ? "Please wait before requesting again. You can still check status."
              : (error.message ??
                "Please check status before requesting again.")
          }
          primaryActionTitle="Check status"
          onPrimaryAction={checkStatus}
        />
      )}
      <View className="gap-2">
        {throttled && !error && (
          <AppText className="text-sm leading-5 text-text-secondary">
            Please wait before requesting again. You can still check status.
          </AppText>
        )}
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={requestLabel}
          accessibilityState={{
            disabled: active || requesting || checking || throttled,
            busy: requesting,
          }}
          disabled={active || requesting || checking || throttled}
          onPress={requestRefresh}
          className={`min-h-12 cursor-pointer items-center justify-center rounded-full bg-brand px-4 py-3 ${active || requesting || checking || throttled ? "opacity-50" : "active:opacity-70"}`}
        >
          <AppText weight="bold" className="text-sm text-white">
            {requesting ? "Sending request…" : requestLabel}
          </AppText>
        </SafePressable>
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel="Check recommendation status"
          accessibilityState={{ disabled: checking, busy: checking }}
          disabled={checking}
          onPress={checkStatus}
          className="min-h-12 cursor-pointer items-center justify-center px-4 py-2 active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-text-info">
            {checking ? "Checking status…" : "Check status"}
          </AppText>
        </SafePressable>
        <AppText className="text-sm leading-5 text-text-secondary">
          Pull to refresh checks status. It does not request new
          recommendations.
        </AppText>
      </View>

      <AnalyticsDetailContext
        title="About business recommendations"
        meta={report.meta}
        note={report.measurement_note}
      />
    </View>
  );
}
