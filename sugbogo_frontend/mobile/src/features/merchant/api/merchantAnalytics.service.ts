import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  MerchantAnalyticsPeriod,
  MerchantStandardAnalytics,
} from "../types/merchantAnalytics.types";

/** Reads Standard aggregates; the backend derives business ownership from JWT. */
export async function getMerchantStandardAnalytics(
  period: MerchantAnalyticsPeriod,
): Promise<ApiResponse<MerchantStandardAnalytics>> {
  return request(
    apiClient.get("/merchant/analytics/standard/", {
      params: { period },
    }),
  );
}
