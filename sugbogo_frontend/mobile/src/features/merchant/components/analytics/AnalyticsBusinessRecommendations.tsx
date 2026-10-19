import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, type ComponentProps } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import SafePressable from "@/shared/components/SafePressable";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import type { ApiError } from "@/shared/types/apiResponse.types";
import type {
  PlusRecommendationsReport,
  RecommendationRefreshResult,
  RecommendationState,
} from "../../types/merchantAdvancedAnalytics.types";
import { formatAnalyticsDate } from "../../utils/merchantAnalytics.utils";
import { formatOptionalAnalyticsTimestamp } from "../../utils/merchantPlusAnalytics.utils";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsReportSheet from "./AnalyticsReportSheet";
import { PlusReportContext } from "./AnalyticsPlusStates";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
const ACTIONS: Record<
  string,
  { title: string; icon: IconName; link?: string }
> = {
  UNANSWERED_REVIEWS: {
    title: "Reply to unanswered reviews",
    icon: "comment-text-outline",
    link: "Review oldest first",
  },
  STORED_INSIGHTS_OUTDATED: {
    title: "Check your review insights",
    icon: "text-box-search-outline",
    link: "Open review insights",
  },
};
const LIMITATIONS: Record<string, { title: string; description: string }> = {
  INSUFFICIENT_SENTIMENT: {
    title: "Limited review feedback",
    description:
      "More reviews with feedback labels are needed before drawing an overall conclusion.",
  },
  STORED_INSIGHTS_MISSING: {
    title: "No review summary yet",
    description: "A stored review summary is not available.",
  },
  STORED_CONTENT_UNAVAILABLE: {
    title: "Review insights unavailable",
    description: "The stored summary and mentions are not currently available.",
  },
  VISIBILITY_UNAVAILABLE: {
    title: "Some activity is unavailable",
    description:
      "Missing profile-visit or save data does not mean zero activity.",
  },
  VISIBILITY_COVERAGE_UNVERIFIED: {
    title: "Recorded activity may be incomplete",
    description: "Profile visits and saves cannot establish reliable growth.",
  },
  INSUFFICIENT_PEERS: {
    title: "Limited business comparisons",
    description:
      "More qualifying businesses are needed for an anonymous comparison.",
  },
  INSUFFICIENT_SENTIMENT_PEERS: {
    title: "Limited feedback comparisons",
    description:
      "Your business or similar businesses need more review feedback to support this comparison.",
  },
};
const STATES: Record<
  RecommendationState,
  { title: string; description: string }
> = {
  not_requested: {
    title: "Available next steps",
    description:
      "AI-assisted suggestions have not been requested for these dates.",
  },
  pending: {
    title: "Your request is queued",
    description: "Check status to see when your suggestions are ready.",
  },
  running: {
    title: "Preparing your suggestions",
    description: "Check status for the latest progress.",
  },
  ready: {
    title: "Suggestions ready",
    description: "Based on the information captured for this report.",
  },
  insufficient_data: {
    title: "No AI-assisted suggestions available",
    description:
      "There is not enough eligible evidence. Any supported next steps remain below.",
  },
  failed: {
    title: "Unable to prepare suggestions",
    description: "Check status before requesting another update.",
  },
  invalidated: {
    title: "Suggestions need updating",
    description:
      "The supporting information or reporting rules changed. Previous AI-assisted suggestions are hidden.",
  },
};
const RULES: { title: string; text: string; icon: IconName }[] = [
  {
    title: "Supported next steps",
    icon: "format-list-checks",
    text: "Suggestions currently cover unanswered reviews, limited review feedback, and outdated review insights. They do not predict sales or explain why business activity changed.",
  },
  {
    title: "AI-assisted selection",
    icon: "auto-fix",
    text: "AI selects and orders supported actions and approved wording. The backend calculates the facts. Without a valid generated result, available rule-based actions are shown instead.",
  },
  {
    title: "Dates and freshness",
    icon: "calendar-clock",
    text: "Suggestions use a recent 30-day reporting window and current items needing attention. Unanswered reviews describe the current backlog. Review insights retain their own dates. Prepared suggestions use their original snapshot, not later activity; changes can make them need updating.",
  },
  {
    title: "Requesting an update",
    icon: "refresh",
    text: "Get or Update recommendations explicitly requests background processing. Checking status or pulling to refresh does not generate new suggestions. Requests may be limited while another request is active.",
  },
];

/** Presents supported actions once, with evidence, while preserving explicit generation and read-only refresh. */
export default function AnalyticsBusinessRecommendations({
  report,
  refreshResult,
  refreshError,
  requesting,
  checking,
  throttled,
  cooldownRemainingSeconds = 0,
  requestRefresh,
  checkStatus,
  loading = false,
  error,
  onOpenAction,
}: {
  report?: PlusRecommendationsReport;
  refreshResult?: RecommendationRefreshResult;
  refreshError: unknown;
  requesting: boolean;
  checking: boolean;
  throttled: boolean;
  cooldownRemainingSeconds?: number;
  requestRefresh: () => void;
  checkStatus: () => void;
  loading?: boolean;
  error?: unknown;
  onOpenAction?: (code: string) => void;
}) {
  const informationRef = useRef<BottomSheetModal>(null);
  const newer = Boolean(
    refreshResult && refreshResult.request_id !== report?.request_id,
  );
  const state = newer ? refreshResult!.state : report?.state;
  const active = state === "pending" || state === "running";
  const copy = state ? STATES[state] : undefined;
  const generated = Boolean(
    report?.content_available && report.state === "ready" && !newer,
  );
  const selectedActions = generated
    ? report!.ai_recommendations.map((item) => ({
        code: item.action_code,
        message: item.message,
        evidence: item.evidence_codes,
      }))
    : [];
  const chosenCodes = new Set(selectedActions.map((item) => item.code));
  const actions = [
    ...selectedActions,
    ...(report?.recommended_actions ?? [])
      .filter((item) => !chosenCodes.has(item.code))
      .map((item) => ({ ...item, evidence: [item.code] })),
  ].filter((item) => item.code !== "INSUFFICIENT_SENTIMENT");
  const shownCodes = new Set(actions.flatMap((item) => item.evidence));
  const limitations = (report?.key_findings ?? []).filter(
    (item) => !shownCodes.has(item.code),
  );
  const source = report?.source_period ?? report?.requested_selection;
  const mutationError = refreshError as Partial<ApiError> | null;
  const disabled = active || requesting || checking || throttled || !report;
  const pending = loading && !report;
  const rateLimited =
    throttled || mutationError?.code === "RATE_LIMIT_EXCEEDED";
  const requestInProgress =
    active || mutationError?.code === "RECOMMENDATION_REFRESH_IN_PROGRESS";
  const showRequestButton =
    !rateLimited && !requestInProgress && !mutationError;

  return (
    <>
      <View className="gap-5">
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="min-w-0 flex-1 text-base text-text-primary"
            >
              Recommendations
            </AppText>
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="About business recommendations"
              accessibilityHint="Explains supported suggestions, dates, and updates"
              onPress={() => informationRef.current?.present()}
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
                ? "Unable to refresh suggestions"
                : "Unable to load suggestions"
            }
            description={
              report
                ? "Previously loaded information is still shown."
                : "Please try this report again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={checkStatus}
          />
        )}
        {pending ? (
          <View
            accessibilityLabel="Loading recommendations"
            accessibilityState={{ busy: true }}
            className="gap-4"
          >
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-20 w-full rounded-card" />
          </View>
        ) : (
          report && (
            <>
              {!generated && copy && state !== "not_requested" && (
                <View className="flex-row items-start gap-3 rounded-xl bg-surface-muted p-3">
                  <MaterialCommunityIcons
                    name={active ? "clock-outline" : "information-outline"}
                    size={20}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                  <View className="min-w-0 flex-1 gap-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {copy.title}
                    </AppText>
                    <AppText className="text-sm leading-5 text-text-secondary">
                      {copy.description}
                    </AppText>
                  </View>
                </View>
              )}
              {newer && (
                <AppText className="text-xs leading-5 text-text-secondary">
                  The findings below belong to the previous report, not the
                  newer request.
                </AppText>
              )}
              {actions.length > 0 ? (
                <View className="gap-4">
                  {actions.map((item) => {
                    const presentation = ACTIONS[item.code];
                    const evidence = item.evidence
                      .map((code) =>
                        report.key_findings.find(
                          (finding) => finding.code === code,
                        ),
                      )
                      .filter((finding) => finding !== undefined);
                    const assisted = generated && chosenCodes.has(item.code);
                    const emphasized = assisted;
                    return (
                      <View
                        key={item.code}
                        className={
                          emphasized
                            ? "gap-4 rounded-card border border-brand/20 bg-brand/5 p-4"
                            : "gap-3 rounded-card border border-border-primary/60 bg-surface-muted p-4"
                        }
                      >
                        <View className="flex-row items-center gap-1.5">
                          <MaterialCommunityIcons
                            name={assisted ? "auto-fix" : "lightbulb-outline"}
                            size={16}
                            color={
                              assisted
                                ? theme.extends.colors.brand
                                : theme.extends.colors.text.secondary
                            }
                            accessible={false}
                          />
                          <AppText className="text-xs text-text-secondary">
                            {assisted
                              ? "AI-assisted"
                              : "Based on your activity"}
                          </AppText>
                        </View>
                        <AppText
                          accessibilityRole="header"
                          weight="bold"
                          className={`text-text-primary ${emphasized ? "text-lg leading-6" : "text-base"}`}
                        >
                          {presentation?.title ?? "Suggested action"}
                        </AppText>
                        <AppText className="text-sm leading-6 text-text-primary">
                          {item.message}
                        </AppText>
                        {evidence.length > 0 && (
                          <View className="gap-1 border-t border-border-primary/60 pt-3">
                            <AppText
                              weight="semibold"
                              className="text-xs text-text-secondary"
                            >
                              Why this appears
                            </AppText>
                            {evidence.map((finding) => (
                              <AppText
                                key={finding.code}
                                className="text-sm leading-5 text-text-secondary"
                              >
                                {finding.message}
                              </AppText>
                            ))}
                          </View>
                        )}
                        {presentation?.link && onOpenAction && (
                          <SafePressable
                            accessibilityRole="button"
                            accessibilityLabel={presentation.link}
                            onPress={() => onOpenAction(item.code)}
                            className="min-h-11 max-w-full cursor-pointer flex-row items-center gap-1 self-start active:opacity-70"
                          >
                            <AppText
                              weight="semibold"
                              className="min-w-0 shrink text-sm text-brand"
                            >
                              {presentation.link}
                            </AppText>
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={19}
                              color={theme.extends.colors.brand}
                              accessible={false}
                            />
                          </SafePressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <AnalyticsChartEmptyState
                  compact
                  icon="lightbulb-outline"
                  title="No supported suggestions available right now"
                  description="This does not indicate how well your business is performing."
                />
              )}
              {limitations.length > 0 && (
                <View className="gap-4 border-t border-border-primary/60 pt-5">
                  <AppText
                    accessibilityRole="header"
                    weight="bold"
                    className="text-base text-text-primary"
                  >
                    Before drawing conclusions
                  </AppText>
                  {limitations.map((item) => (
                    <View
                      key={item.code}
                      className="flex-row items-start gap-3"
                    >
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={18}
                        color={theme.extends.colors.text.secondary}
                        accessible={false}
                      />
                      <View className="min-w-0 flex-1 gap-1">
                        <AppText
                          weight="semibold"
                          className="text-sm text-text-primary"
                        >
                          {LIMITATIONS[item.code]?.title ?? "Report limitation"}
                        </AppText>
                        <AppText className="text-sm leading-5 text-text-secondary">
                          {LIMITATIONS[item.code]?.description ?? item.message}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <View className="gap-2 border-t border-border-primary/60 pt-4">
                {generated && report.generated_at && (
                  <AppText className="text-xs text-text-secondary">
                    Prepared{" "}
                    {new Date(report.generated_at).toLocaleDateString("en-PH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Manila",
                    })}
                  </AppText>
                )}
                {(rateLimited || mutationError) && (
                  <View
                    accessibilityLiveRegion="polite"
                    className="flex-row items-start gap-2 py-2"
                  >
                    <MaterialCommunityIcons
                      name={
                        rateLimited ? "clock-outline" : "information-outline"
                      }
                      size={18}
                      color={theme.extends.colors.text.secondary}
                      accessible={false}
                    />
                    <AppText className="min-w-0 flex-1 text-sm leading-5 text-text-secondary">
                      {rateLimited
                        ? cooldownRemainingSeconds > 0
                          ? `You can request another update in ${Math.floor(cooldownRemainingSeconds / 60)}:${String(cooldownRemainingSeconds % 60).padStart(2, "0")}.`
                          : "Please wait before requesting another update."
                        : requestInProgress
                          ? "Another request is already being prepared."
                          : (mutationError?.message ??
                            "Unable to request suggestions. Check status before trying again.")}
                    </AppText>
                  </View>
                )}
                {showRequestButton && (
                  <SafePressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      state === "not_requested"
                        ? "Get recommendations"
                        : "Update recommendations"
                    }
                    accessibilityState={{ disabled, busy: requesting }}
                    disabled={disabled}
                    onPress={requestRefresh}
                    className={`min-h-12 cursor-pointer items-center justify-center rounded-full bg-brand px-4 py-3 ${disabled ? "opacity-50" : "active:opacity-70"}`}
                  >
                    <AppText weight="bold" className="text-sm text-white">
                      {requesting
                        ? "Sending request..."
                        : state === "not_requested"
                          ? "Get recommendations"
                          : "Update recommendations"}
                    </AppText>
                  </SafePressable>
                )}
                {(requestInProgress ||
                  state === "failed" ||
                  state === "invalidated" ||
                  throttled ||
                  Boolean(mutationError)) && (
                  <SafePressable
                    accessibilityRole="button"
                    accessibilityLabel="Check recommendation status"
                    accessibilityState={{ disabled: checking, busy: checking }}
                    disabled={checking}
                    onPress={checkStatus}
                    className="min-h-11 cursor-pointer items-center justify-center px-4 py-2 active:opacity-70"
                  >
                    <AppText weight="semibold" className="text-sm text-brand">
                      {checking ? "Checking status..." : "Check status"}
                    </AppText>
                  </SafePressable>
                )}
              </View>
            </>
          )
        )}
      </View>
      <AnalyticsReportSheet
        sheetRef={informationRef}
        title="About business recommendations"
        closeLabel="Close recommendation information"
        description="Supported actions and their limits."
      >
        <View className="gap-5">
          {RULES.map((rule, index) => (
            <View
              key={rule.title}
              className={`flex-row items-start gap-3 ${index ? "border-t border-border-primary/60 pt-4" : ""}`}
            >
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
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
              {source && (
                <AppText className="text-sm leading-6 text-text-secondary">
                  Reporting dates: {formatAnalyticsDate(source.start_date)} -{" "}
                  {formatAnalyticsDate(source.end_date)}
                </AppText>
              )}
              <AppText className="text-sm leading-6 text-text-secondary">
                Information captured:{" "}
                {formatOptionalAnalyticsTimestamp(
                  report.source_period?.snapshot_as_of ?? null,
                )}
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                Last status check:{" "}
                {formatOptionalAnalyticsTimestamp(report.checked_at)}
              </AppText>
              <PlusReportContext
                meta={report.meta}
                note={report.measurement_note}
              />
            </View>
          )}
        </View>
      </AnalyticsReportSheet>
    </>
  );
}
