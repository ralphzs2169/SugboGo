import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

export const MERCHANT_STANDARD_ANALYTICS_QUERY_KEY = [
  "merchant-standard-analytics",
] as const;

/** Scopes every period variant to the authenticated merchant account. */
export function merchantStandardAnalyticsKey(
  userId: number | undefined,
  period: MerchantAnalyticsPeriod,
) {
  return [...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY, userId, period] as const;
}
