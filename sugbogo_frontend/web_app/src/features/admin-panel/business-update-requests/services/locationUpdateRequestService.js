import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/businesses/update-requests/location/";

export async function fetchLocationUpdateRequests(params) {
  const response = await apiClient.get(BASE_URL, { params });
  return response.data.data;
}

export async function fetchLocationUpdateRequest(requestId) {
  const response = await apiClient.get(`${BASE_URL}${requestId}/`);
  return response.data.data;
}

export async function approveLocationUpdateRequest(requestId) {
  const response = await apiClient.post(`${BASE_URL}${requestId}/approve/`);
  return response.data.data;
}

export async function rejectLocationUpdateRequest(requestId, rejectionReason) {
  const response = await apiClient.post(`${BASE_URL}${requestId}/reject/`, {
    rejection_reason: rejectionReason,
  });
  return response.data.data;
}
