import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { DiscoverySourcesReport } from "../types/discoverySources.types";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";

/** Reads only the caller's Standard source report, without any Plus request. */
export function getMerchantDiscoverySources(
  period: MerchantAnalyticsPeriod,
  signal?: AbortSignal,
): Promise<ApiResponse<DiscoverySourcesReport>> {
  return request(
    apiClient.get("/merchant/analytics/standard/discovery-sources/", {
      params: { period },
      signal,
    }),
  );
}
