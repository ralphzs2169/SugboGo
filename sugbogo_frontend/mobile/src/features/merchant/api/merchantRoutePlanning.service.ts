import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";
import type { RoutePlanningAnalytics } from "../types/routePlanningAnalytics.types";

/** Reads the selected Manila period for the server-resolved owned business. */
export function getMerchantRoutePlanning(
  period: MerchantAnalyticsPeriod,
  signal?: AbortSignal,
): Promise<ApiResponse<RoutePlanningAnalytics>> {
  return request(
    apiClient.get("/merchant/analytics/standard/route-planning/", {
      params: { period },
      signal,
    }),
  );
}
