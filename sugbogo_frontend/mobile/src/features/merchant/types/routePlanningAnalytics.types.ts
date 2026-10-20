import type {
  MerchantStandardAnalytics,
  StandardAnalyticsMeta,
} from "./merchantAnalytics.types";

/** Recorded intent counts; null means unavailable rather than no activity. */
export type RoutePlanningAnalytics = {
  business: MerchantStandardAnalytics["business"];
  total_requests: number | null;
  distinct_explorer_accounts: number | null;
  road_route_requests: number | null;
  jeepney_requests: number | null;
  tracking_started_at: string | null;
  meta: StandardAnalyticsMeta;
};
