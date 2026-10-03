import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  BusinessNameChangeRequest,
  BusinessNameChangeRequestPage,
  SubmitBusinessNameChangePayload,
} from "../types/businessNameChange.types";

const BASE_PATH = "/merchant/business-profile/update-requests/";

export function getBusinessNameChangeRequests(
  page: number,
): Promise<ApiResponse<BusinessNameChangeRequestPage>> {
  return request(apiClient.get(BASE_PATH, { params: { page } }));
}

export function getBusinessNameChangeRequest(
  requestId: number,
): Promise<ApiResponse<BusinessNameChangeRequest>> {
  return request(apiClient.get(`${BASE_PATH}${requestId}/`));
}

export function submitBusinessNameChange(
  payload: SubmitBusinessNameChangePayload,
): Promise<ApiResponse<BusinessNameChangeRequest>> {
  return request(apiClient.post(`${BASE_PATH}business-name/`, payload));
}

export function withdrawBusinessNameChange(
  requestId: number,
): Promise<ApiResponse<BusinessNameChangeRequest>> {
  return request(apiClient.post(`${BASE_PATH}${requestId}/withdraw/`));
}
