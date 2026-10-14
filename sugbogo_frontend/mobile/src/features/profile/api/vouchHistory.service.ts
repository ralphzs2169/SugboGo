import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  VouchHistoryOrdering,
  VouchHistoryResponse,
} from "../types/vouchHistory.types";

/** Loads one backend-ordered page of the authenticated user's business history. */
export function getVouchHistory(
  ordering: VouchHistoryOrdering,
  page: number,
): Promise<ApiResponse<VouchHistoryResponse>> {
  return request(
    apiClient.get("/explorer/explore/vouch-history/", {
      params: { ordering, page },
    }),
  );
}
