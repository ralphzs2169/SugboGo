/** Supported Standard selections; custom dates are deferred in the mobile MVP. */
export type MerchantAnalyticsPeriod = "7" | "30" | "90";

export type AnalyticsAvailability = "available" | "partial" | "unavailable";

/** Mirrors the Standard serializer without inventing previous-period fields. */
export type StandardAnalyticsMeta = {
  period: {
    timezone: string;
    start_date: string;
    end_date: string;
    start: string;
    end_exclusive: string;
  };
  data_through: string | null;
  generated_at: string;
  availability: AnalyticsAvailability;
  is_partial: boolean;
  partial_reason: string | null;
  partial_reasons: string[];
  coverage_verified: boolean;
};

export type AnalyticsSpecialtySupport = {
  specialty_id: number;
  specialty_name: string;
  valid_vouches: number;
  distinct_supporters: number;
};

/** Exact owned-business Standard response, including independent source metadata. */
export type MerchantStandardAnalytics = {
  business: {
    id: number;
    name: string;
    status: string;
  };
  profile_visits: number | null;
  distinct_profile_visitors: number | null;
  saves_in_period: number | null;
  current_pocket_holders: number;
  specialty_support: AnalyticsSpecialtySupport[];
  reviews: {
    new_published_in_period: number;
    current_published_total: number;
    current_unanswered_published: number;
    period_eligible_published: number;
    period_replied_published: number;
    reply_rate: number | null;
    reply_cutoff: string;
    excluded_reply_timestamp_count: number;
  };
  snapshot_as_of: string;
  meta: StandardAnalyticsMeta;
  sources: {
    domain: StandardAnalyticsMeta;
    visibility: StandardAnalyticsMeta;
  };
};
