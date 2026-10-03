import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  LocationChangeRequest,
  LocationChangeRequestPage,
  SubmitLocationChangePayload,
} from "../types/locationChange.types";

const BASE_PATH = "/merchant/business-profile/update-requests/location/";

export function getLocationChangeRequests(
  page: number,
): Promise<ApiResponse<LocationChangeRequestPage>> {
  return request(apiClient.get(BASE_PATH, { params: { page } }));
}

export function getLocationChangeRequest(
  requestId: number,
): Promise<ApiResponse<LocationChangeRequest>> {
  return request(apiClient.get(`${BASE_PATH}${requestId}/`));
}

export function submitLocationChange(
  payload: SubmitLocationChangePayload,
): Promise<ApiResponse<LocationChangeRequest>> {
  return request(apiClient.post(BASE_PATH, payload));
}

export function withdrawLocationChange(
  requestId: number,
): Promise<ApiResponse<LocationChangeRequest>> {
  return request(apiClient.post(`${BASE_PATH}${requestId}/withdraw/`));
}
