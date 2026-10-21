import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { LoginHistoryResponse } from "../types/loginHistory.types";

/** Reads a page of the signed-in account's recent authentication activity. */
export function getLoginHistory(
  page: number,
): Promise<ApiResponse<LoginHistoryResponse>> {
  return request(apiClient.get("/auth/login-history/", { params: { page } }));
}
