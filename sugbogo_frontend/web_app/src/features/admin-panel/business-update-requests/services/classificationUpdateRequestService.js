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

/** Retrieves an existing taxonomy tag's display metadata by ID. */
export async function fetchClassificationSpecialtyDisplay(tagId) {
  const response = await apiClient.get(
    `/admin/taxonomy/specialty-tags/${tagId}/`,
  );
  return response.data.data;
}

/** Retrieves an existing taxonomy cluster's icon by ID. */
export async function fetchClassificationClusterDisplay(clusterId) {
  const response = await apiClient.get(
    `/admin/taxonomy/clusters/${clusterId}/`,
  );
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
