import type { User } from "@/features/users/types/user.types";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  MerchantStandardAnalytics,
  StandardAnalyticsMeta,
  MerchantUnansweredReviewsSummary,
} from "../types/merchantAnalytics.types";

export function unansweredReviewsSummary(
  overrides: Partial<MerchantUnansweredReviewsSummary> = {},
): MerchantUnansweredReviewsSummary {
  return {
    business: { id: 8, name: "Cebu Coffee", status: "active" },
    total_unanswered: 8,
    under_3_days: 2,
    days_3_to_6: 3,
    days_7_plus: 3,
    snapshot_as_of: "2026-10-17T04:00:00+00:00",
    ...overrides,
  };
}

export function analyticsMerchant(id = 42): User {
  return {
    id,
    first_name: "Alex",
    last_name: "Merchant",
    gender: null,
    email: `merchant-${id}@example.com`,
    role: "merchant",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  };
}

export function standardAnalyticsMeta(): StandardAnalyticsMeta {
  return {
    period: {
      timezone: "Asia/Manila",
      start_date: "2026-09-18",
      end_date: "2026-10-17",
      start: "2026-09-17T16:00:00+00:00",
      end_exclusive: "2026-10-17T04:00:00+00:00",
    },
    generated_at: "2026-10-17T04:00:00+00:00",
    data_through: null,
    availability: "partial",
    is_partial: true,
    partial_reason: "coverage_unverified",
    partial_reasons: [
      "coverage_unverified",
      "freshness_unverified",
      "current_day_incomplete",
    ],
    coverage_verified: false,
  };
}

export function standardAnalyticsReport(
  overrides: Partial<MerchantStandardAnalytics> = {},
): MerchantStandardAnalytics {
  const domain = {
    ...standardAnalyticsMeta(),
    coverage_verified: true,
    data_through: "2026-10-17T04:00:00+00:00",
    partial_reason: "current_state_reporting",
    partial_reasons: ["current_state_reporting", "current_day_incomplete"],
  };

  return {
    business: { id: 8, name: "Cebu Coffee", status: "active" },
    profile_visits: 24,
    distinct_profile_visitors: 12,
    saves_in_period: 5,
    current_pocket_holders: 18,
    current_valid_vouches: 8,
    vouches_added_and_still_valid: 3,
    specialty_support: [
      {
        specialty_id: 1,
        specialty_name: "Coffee",
        valid_vouches: 2,
        distinct_supporters: 2,
      },
      {
        specialty_id: 2,
        specialty_name: "Friendly service",
        valid_vouches: 6,
        distinct_supporters: 6,
      },
    ],
    reviews: {
      new_published_in_period: 4,
      current_published_total: 10,
      current_unanswered_published: 3,
      period_eligible_published: 4,
      period_replied_published: 1,
      reply_rate: 25,
      reply_cutoff: "2026-10-17T04:00:00+00:00",
      excluded_reply_timestamp_count: 0,
    },
    snapshot_as_of: "2026-10-17T04:00:00+00:00",
    meta: standardAnalyticsMeta(),
    sources: { domain, visibility: standardAnalyticsMeta() },
    ...overrides,
  };
}

export function analyticsSuccess(
  report = standardAnalyticsReport(),
): ApiResponse<MerchantStandardAnalytics> {
  return { success: true, message: "Analytics retrieved.", data: report };
}

export function deferredAnalytics() {
  let resolve!: (value: ApiResponse<MerchantStandardAnalytics>) => void;
  const promise = new Promise<ApiResponse<MerchantStandardAnalytics>>(
    (complete) => {
      resolve = complete;
    },
  );

  return { promise, resolve };
}
