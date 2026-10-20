import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { MerchantRecentActivity } from "../types/merchantRecentActivity.types";

/** Reads the owned business timeline without reporting-period or inbox filters. */
export function getMerchantRecentActivity(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantRecentActivity>> {
  return request(
    apiClient.get("/merchant/dashboard/recent-activity/", { signal }),
  );
}
