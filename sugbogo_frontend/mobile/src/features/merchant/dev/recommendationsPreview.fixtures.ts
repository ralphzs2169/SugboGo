import type {
  PlusRecommendationsReport,
  RecommendationState,
} from "../types/merchantAdvancedAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";

export type RecommendationsPreviewScenario =
  | RecommendationState
  | "loading"
  | "unavailable"
  | "empty"
  | "partial"
  | "fallback"
  | "activity";

/** Isolated illustrative data; no persistence, provider calls, or real business identities. */
export function recommendationsPreviewReport(
  period: MerchantAnalyticsPeriod,
  scenario: RecommendationsPreviewScenario,
): PlusRecommendationsReport {
  const end = new Date("2026-10-19T04:00:00Z");
  const start = new Date("2026-10-18T16:00:00Z");
  start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const startDate = new Date(start.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const source = {
    timezone: "Asia/Manila",
    start_date: startDate,
    end_date: "2026-10-19",
    start: start.toISOString(),
    end_exclusive: end.toISOString(),
    previous_start: new Date(
      start.getTime() - (end.getTime() - start.getTime()),
    ).toISOString(),
    previous_end_exclusive: start.toISOString(),
    snapshot_as_of: end.toISOString(),
    includes_partial_day: true,
  };
  const state: RecommendationState =
    scenario === "loading" ||
    scenario === "unavailable" ||
    scenario === "empty" ||
    scenario === "activity"
      ? "not_requested"
      : scenario === "partial"
        ? "ready"
        : scenario === "fallback"
          ? "failed"
          : scenario;
  const ready = state === "ready";
  const hasActions =
    ready || scenario === "fallback" || scenario === "activity";
  const findings = [
    {
      code: "UNANSWERED_REVIEWS",
      message: "8 published reviews are waiting for a reply.",
    },
    {
      code: "STORED_INSIGHTS_OUTDATED",
      message: "The saved review insights need updating.",
    },
    {
      code: "INSUFFICIENT_SENTIMENT",
      message:
        "Too few reviews have feedback labels for an overall conclusion.",
    },
    {
      code: "VISIBILITY_COVERAGE_UNVERIFIED",
      message: "Recorded activity may be incomplete.",
    },
  ].filter((finding) => {
    if (scenario === "empty") return false;
    if (hasActions) return true;
    return (
      finding.code === "INSUFFICIENT_SENTIMENT" ||
      finding.code === "VISIBILITY_COVERAGE_UNVERIFIED"
    );
  });
  if (scenario === "partial")
    findings.push({
      code: "VISIBILITY_UNAVAILABLE",
      message: "Some recorded activity is unavailable.",
    });
  return {
    business: { id: 0, name: "Synthetic preview business", status: "active" },
    state,
    stored_state: state === "not_requested" ? null : state,
    request_id: state === "not_requested" ? null : "demo-request",
    source_period: state === "not_requested" ? null : source,
    requested_selection: { start_date: startDate, end_date: "2026-10-19" },
    requested_at: state === "not_requested" ? null : end.toISOString(),
    generated_at: ready ? end.toISOString() : null,
    checked_at: end.toISOString(),
    evidence_matches: state !== "invalidated",
    snapshot_only: true,
    content_available: ready,
    ai_recommendations: ready
      ? [
          {
            action_code: "UNANSWERED_REVIEWS",
            evidence_codes: ["UNANSWERED_REVIEWS"],
            explanation_code: "review_backlog",
            message:
              "Review the unanswered published-review backlog and respond where appropriate.",
          },
        ]
      : [],
    generation_policy: null,
    provenance: null,
    error_code: state === "failed" ? "provider_temporarily_unavailable" : null,
    key_findings: findings,
    recommended_actions: !hasActions
      ? []
      : [
          {
            code: "UNANSWERED_REVIEWS",
            message:
              "Review the unanswered published-review backlog and respond where appropriate.",
          },
          {
            code: "STORED_INSIGHTS_OUTDATED",
            message:
              "Check the stored insights state and generation date before using the narrative or mentions.",
          },
          {
            code: "INSUFFICIENT_SENTIMENT",
            message:
              "Wait for sufficient classified review data before drawing sentiment conclusions.",
          },
        ],
    meta: {
      period: source,
      data_through: end.toISOString(),
      generated_at: end.toISOString(),
      availability: "partial",
      is_partial: true,
      partial_reason: "coverage_unverified",
      partial_reasons: ["coverage_unverified"],
      coverage_verified: false,
    },
    measurement_note:
      "Synthetic preview only. No real tracking coverage or generation history is asserted.",
  };
}
