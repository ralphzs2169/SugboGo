import type {
  PeerMetric,
  PlusPeerReport,
} from "../types/merchantAdvancedAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";

export type PeerPreviewScenario =
  | "populated"
  | "insufficient"
  | "partial"
  | "unavailable"
  | "zeros"
  | "loading";

/** Synthetic development fixtures only; never read or update application data. */
export function peerPreviewReport(
  period: MerchantAnalyticsPeriod,
  scenario: PeerPreviewScenario,
): PlusPeerReport {
  const end = new Date("2026-10-19T04:00:00Z");
  const start = new Date("2026-10-18T16:00:00Z");
  start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const previous = new Date(
    start.getTime() - (end.getTime() - start.getTime()),
  );
  const unavailable = scenario === "unavailable";
  const insufficient = scenario === "insufficient";
  const factor = Number(period) / 30;
  const metric = (
    own: number,
    median: number,
    unit = "events",
  ): PeerMetric => ({
    label: "Synthetic comparison",
    unit,
    status: unavailable
      ? "unavailable"
      : insufficient
        ? "insufficient_data"
        : "partial",
    reason: unavailable
      ? "source_unavailable"
      : insufficient
        ? "peer_group_too_small"
        : "coverage_unverified",
    merchant_value:
      unavailable || insufficient
        ? null
        : scenario === "zeros"
          ? 0
          : unit === "percent"
            ? own
            : Math.round(own * factor),
    peer_median:
      unavailable || insufficient
        ? null
        : scenario === "zeros"
          ? 0
          : unit === "percent"
            ? median
            : Math.round(median * factor),
    position: null,
    eligible_peer_sample_size: insufficient ? 3 : 8,
    merchant_classified_review_count: null,
  });
  const meta: PlusPeerReport["meta"] = {
    period: {
      timezone: "Asia/Manila",
      start_date: new Date(start.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      end_date: "2026-10-19",
      start: start.toISOString(),
      end_exclusive: end.toISOString(),
      previous_start: previous.toISOString(),
      previous_end_exclusive: start.toISOString(),
    },
    data_through: end.toISOString(),
    generated_at: end.toISOString(),
    availability: unavailable ? "unavailable" : "partial",
    is_partial: true,
    partial_reason: unavailable ? "source_unavailable" : "coverage_unverified",
    partial_reasons: [
      unavailable ? "source_unavailable" : "coverage_unverified",
    ],
    coverage_verified: false,
  };
  const report: PlusPeerReport = {
    business: { id: 0, name: "Synthetic preview business", status: "active" },
    status: insufficient
      ? "insufficient_data"
      : unavailable
        ? "unavailable"
        : "partial",
    reason: null,
    group: {
      scope: "category",
      size: insufficient ? 3 : 8,
      minimum_size: 5,
      policy_version: 1,
      positive_share_min_classified_reviews: 5,
      fallback_reason: null,
      eligibility: "Synthetic anonymous group",
    },
    metrics: {
      profile_visits: metric(128, 94),
      saves: metric(18, 24),
      specialty_support: metric(12, 12, "endorsements"),
      positive_review_share: metric(75, 62.5, "percent"),
    },
    sources: { visibility: meta, domain: meta },
    meta,
  };
  if (scenario === "partial") {
    report.metrics.saves = {
      ...metric(0, 0),
      status: "unavailable",
      reason: "source_unavailable",
      merchant_value: null,
      peer_median: null,
    };
    report.metrics.positive_review_share = {
      ...metric(0, 0, "percent"),
      status: "insufficient_data",
      reason: "merchant_sentiment_sample_too_small",
      merchant_value: null,
      peer_median: null,
    };
  }
  return report;
}
