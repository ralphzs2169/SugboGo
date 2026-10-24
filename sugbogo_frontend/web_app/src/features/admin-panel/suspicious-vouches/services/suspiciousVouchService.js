import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/suspicious-vouches/";

export async function fetchSuspiciousVouches(params = {}) {
  const response = await apiClient.get(BASE_URL, { params });
  return response.data.data;
}

export async function fetchSuspiciousVouch(vouchId) {
  const response = await apiClient.get(`${BASE_URL}${vouchId}/`);
  return response.data.data;
}
