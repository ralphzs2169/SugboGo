import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/businesses/update-requests/classification/";

export async function fetchClassificationUpdateRequests(params) {
  const response = await apiClient.get(BASE_URL, { params });
  return response.data.data;
}

export async function fetchClassificationUpdateRequest(requestId) {
  const response = await apiClient.get(`${BASE_URL}${requestId}/`);
  return response.data.data;
}

export async function approveClassificationUpdateRequest(requestId) {
  const response = await apiClient.post(`${BASE_URL}${requestId}/approve/`);
  return response.data.data;
}

export async function rejectClassificationUpdateRequest(
  requestId,
  rejectionReason,
) {
  const response = await apiClient.post(`${BASE_URL}${requestId}/reject/`, {
    rejection_reason: rejectionReason,
  });
  return response.data.data;
}
