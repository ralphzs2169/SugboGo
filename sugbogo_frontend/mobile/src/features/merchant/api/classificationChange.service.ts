import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  ClassificationChangeRequest,
  ClassificationChangeRequestPage,
  SubmitClassificationChangePayload,
} from "../types/classificationChange.types";

const BASE_PATH = "/merchant/business-profile/update-requests/classification/";

export function getClassificationChangeRequests(
  page: number,
): Promise<ApiResponse<ClassificationChangeRequestPage>> {
  return request(apiClient.get(BASE_PATH, { params: { page } }));
}

export function getClassificationChangeRequest(
  requestId: number,
): Promise<ApiResponse<ClassificationChangeRequest>> {
  return request(apiClient.get(`${BASE_PATH}${requestId}/`));
}

export function submitClassificationChange(
  payload: SubmitClassificationChangePayload,
): Promise<ApiResponse<ClassificationChangeRequest>> {
  return request(apiClient.post(BASE_PATH, payload));
}

export function withdrawClassificationChange(
  requestId: number,
): Promise<ApiResponse<ClassificationChangeRequest>> {
  return request(apiClient.post(`${BASE_PATH}${requestId}/withdraw/`));
}
