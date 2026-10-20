import type { BusinessReviewInsights } from "@/features/explore/types/exploreBusiness.types";
import type {
  OwnedAnalyticsBusiness,
  PlusAnalyticsMeta,
  SentimentLabel,
} from "./merchantPlusAnalytics.types";

export type PeerMetric = {
  label: string;
  unit: string;
  status: "available" | "partial" | "insufficient_data" | "unavailable";
  reason: string | null;
  merchant_value: number | null;
  peer_median: number | null;
  position: "above_median" | "at_median" | "below_median" | null;
  eligible_peer_sample_size: number | null;
  merchant_classified_review_count: number | null;
};

export type PlusPeerReport = {
  business: OwnedAnalyticsBusiness;
  status: string;
  reason: string | null;
  group: {
    scope: "category" | "cluster";
    size: number;
    minimum_size: number;
    policy_version: number;
    positive_share_min_classified_reviews: number;
    fallback_reason: string | null;
    eligibility: string;
  };
  metrics: Record<
    "profile_visits" | "saves" | "specialty_support" | "positive_review_share",
    PeerMetric
  >;
  sources: Partial<Record<"visibility" | "domain", PlusAnalyticsMeta>>;
  meta: PlusAnalyticsMeta;
};

/** Reuses public stored content while retaining the serializer's policy and nullable shares. */
export type StoredReviewInsights = Omit<BusinessReviewInsights, "sentiment"> & {
  sentiment: Record<
    SentimentLabel,
    { count: number; percentage: number | null }
  >;
  policy: {
    current_version: number;
    generated_version: number | null;
    provenance: string;
    generation_rules_match: boolean | null;
    thresholds: Record<string, number>;
  };
};

export type PlusStoredInsightsReport = {
  business: OwnedAnalyticsBusiness;
  stored_summary: StoredReviewInsights | null;
  measurement_note: string;
  meta: PlusAnalyticsMeta;
};

export type ProfileTimingCell = {
  id: string;
  weekday: number;
  hour: number;
  profile_visits: number | null;
  state:
    | "outside_period"
    | "visibility_unavailable"
    | "zero_recorded_visits"
    | "recorded_visits";
  period_occurrences: number;
  includes_partial_hour: boolean;
};

export type PlusProfileTimingReport = {
  business: OwnedAnalyticsBusiness;
  label: string;
  metric: "profile_visits";
  timezone: string;
  grid_version: string;
  weekdays: { weekday: number; label: string }[];
  hours: number[];
  cells: ProfileTimingCell[];
  total_profile_visits: number | null;
  display_state:
    "visibility_unavailable" | "recorded_visits" | "zero_recorded_visits";
  sample: {
    nonzero_cells: number | null;
    in_period_cells: number;
    outside_period_cells: number;
    conclusions_available: boolean;
    reason: string;
  };
  legend: {
    method: "linear_count";
    minimum: number | null;
    maximum: number | null;
    zero_range: boolean | null;
  };
  deduplication: string;
  measurement_note: string;
  period_occurrences_note: string;
  sources: { visibility: PlusAnalyticsMeta };
  meta: PlusAnalyticsMeta;
};

export type RecommendationState =
  | "not_requested"
  | "pending"
  | "running"
  | "ready"
  | "insufficient_data"
  | "failed"
  | "invalidated";
export type RecommendationSourcePeriod = PlusAnalyticsMeta["period"] & {
  snapshot_as_of: string;
  includes_partial_day: boolean;
};
export type RecommendationFinding = { code: string; message: string };
export type PlusRecommendationsReport = {
  business: OwnedAnalyticsBusiness;
  state: RecommendationState;
  stored_state: Exclude<RecommendationState, "not_requested"> | null;
  request_id: string | null;
  source_period: RecommendationSourcePeriod | null;
  requested_selection: { start_date: string; end_date: string };
  requested_at: string | null;
  generated_at: string | null;
  checked_at: string;
  evidence_matches: boolean;
  snapshot_only: boolean;
  content_available: boolean;
  ai_recommendations: {
    action_code: string;
    evidence_codes: string[];
    explanation_code: string;
    message: string;
  }[];
  generation_policy: {
    original_version: number;
    current_version: number;
    relevant_rules_match: boolean;
    original_rules: Record<string, unknown>;
  } | null;
  provenance: {
    provider: string;
    model: string;
    prompt_version: string;
    schema_version: string;
    mode: string;
  } | null;
  error_code: string | null;
  key_findings: RecommendationFinding[];
  recommended_actions: RecommendationFinding[];
  meta: PlusAnalyticsMeta;
  measurement_note: string;
};

export type RecommendationRefreshResult = {
  request_id: string;
  state: Exclude<RecommendationState, "not_requested">;
  created: boolean;
  source_period: RecommendationSourcePeriod;
};
