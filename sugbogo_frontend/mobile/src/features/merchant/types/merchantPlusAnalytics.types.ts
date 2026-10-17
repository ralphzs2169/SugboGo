import type {
  MerchantAnalyticsPeriod,
  MerchantStandardAnalytics,
  StandardAnalyticsMeta,
} from "./merchantAnalytics.types";

/** Preset UI selections and the backend's existing custom-date query contract. */
export type AnalyticsSelection =
  | { period: MerchantAnalyticsPeriod }
  | { period: "custom"; start_date: string; end_date: string };

export type AnalyticsInterval = "daily" | "weekly";
export type VisibilityMetric =
  "impressions" | "profile_visits" | "distinct_profile_visitors";
export type PlusDetailKind = "pocket" | "specialties" | "reviews";
export type PlusReportKind = "visibility" | PlusDetailKind;
export type OwnedAnalyticsBusiness = MerchantStandardAnalytics["business"];

/** Premium metadata retains the shared helper's prior-period boundaries. */
export type PlusAnalyticsMeta = Omit<StandardAnalyticsMeta, "period"> & {
  period: StandardAnalyticsMeta["period"] & {
    previous_start: string;
    previous_end_exclusive: string;
  };
};

export type AnalyticsChange = {
  value: number | null;
  direction: string | null;
  unit: string;
  reason: string | null;
};

export type AnalyticsBucket = {
  date: string;
  start: string;
  end_exclusive: string;
};

export type AnalyticsEventMetric = {
  value: number | null;
  previous_value: number | null;
  change: AnalyticsChange;
  series: (AnalyticsBucket & { value: number })[] | null;
  series_is_sparse: boolean;
  sources: { current: PlusAnalyticsMeta; previous: PlusAnalyticsMeta };
};

export type PlusEventReport<K extends string> = {
  business: OwnedAnalyticsBusiness;
  interval: AnalyticsInterval;
  metrics: Record<K, AnalyticsEventMetric>;
  meta: PlusAnalyticsMeta;
  measurement_note: string;
};

export type PlusVisibilityReport = PlusEventReport<VisibilityMetric>;
export type PlusPocketReport = PlusEventReport<"saves" | "distinct_savers">;

export type SpecialtyTrend = {
  specialty_id: number;
  specialty_name: string;
  added_and_still_valid: number;
  distinct_supporters: number;
  series: (AnalyticsBucket & {
    added_and_still_valid: number;
    distinct_supporters: number;
  })[];
};

export type PlusSpecialtyReport = {
  business: OwnedAnalyticsBusiness;
  interval: "weekly";
  label: string;
  specialties: SpecialtyTrend[];
  snapshot_as_of: string;
  meta: PlusAnalyticsMeta;
};

export type SentimentLabel = "positive" | "neutral" | "negative";
export type ReviewMeasures = {
  published_review_count: number;
  replied_review_count: number;
  unanswered_cohort_count: number;
  reply_rate: number | null;
  classified_review_count: number;
  unclassified_review_count: number;
  has_sufficient_sentiment_data: boolean;
  sentiment: Record<
    SentimentLabel,
    { count: number; percentage: number | null }
  >;
};

export type ReviewCohort = ReviewMeasures & {
  median_first_reply_seconds: number | null;
  median_replied_sample_size: number;
};

export type PlusReviewPerformanceReport = {
  business: OwnedAnalyticsBusiness;
  interval: "weekly";
  policy_version: number;
  current: ReviewCohort;
  previous: ReviewCohort;
  reply_rate_change: AnalyticsChange;
  series: (AnalyticsBucket & ReviewMeasures)[];
  current_unanswered_published: number;
  reply_cutoff: string;
  excluded_reply_timestamp_count: number;
  measurement_note: string;
  meta: PlusAnalyticsMeta;
};

/** Read-only server status; preview/mock access is not a paid subscription. */
export type MerchantPlusStatus = {
  business: OwnedAnalyticsBusiness;
  stored_demo_state: "not_created" | "inactive" | "active";
  effective_tier: "standard" | "plus";
  has_plus_access: boolean;
  access_source: "none" | "preview" | "mock";
  enforcement_enabled: boolean;
  mock_enabled: boolean;
  is_simulation: boolean;
  activated_at: string | null;
  reset_at: string | null;
  updated_at: string | null;
};
