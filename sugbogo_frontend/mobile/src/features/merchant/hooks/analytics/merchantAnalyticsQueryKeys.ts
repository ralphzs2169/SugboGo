import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

export const MERCHANT_STANDARD_ANALYTICS_QUERY_KEY = [
  "merchant-standard-analytics",
] as const;

/** Keeps recorded route intent scoped by account and selected reporting window. */
export function merchantRoutePlanningKey(
  userId: number | undefined,
  period: MerchantAnalyticsPeriod,
) {
  return [
    ...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY,
    userId,
    "route-planning",
    period,
  ] as const;
}

/** Scopes every period variant to the authenticated merchant account. */
export function merchantStandardAnalyticsKey(
  userId: number | undefined,
  period: MerchantAnalyticsPeriod,
) {
  return [...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY, userId, period] as const;
}

/** Shares reply-mutation invalidation while remaining independent of date filters. */
export function merchantUnansweredReviewsKey(userId: number | undefined) {
  return [
    ...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY,
    userId,
    "unanswered-reviews",
  ] as const;
}
