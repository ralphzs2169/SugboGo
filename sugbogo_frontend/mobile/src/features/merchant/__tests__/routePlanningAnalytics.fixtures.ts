import type { RoutePlanningAnalytics } from "../types/routePlanningAnalytics.types";
import {
  standardAnalyticsMeta,
  standardAnalyticsReport,
} from "./merchantAnalytics.fixtures";

export function routePlanningReport(
  overrides: Partial<RoutePlanningAnalytics> = {},
): RoutePlanningAnalytics {
  return {
    business: standardAnalyticsReport().business,
    total_requests: 4,
    distinct_explorer_accounts: 3,
    road_route_requests: 3,
    jeepney_requests: 1,
    tracking_started_at: "2026-08-01T00:00:00Z",
    meta: standardAnalyticsMeta(),
    ...overrides,
  };
}
