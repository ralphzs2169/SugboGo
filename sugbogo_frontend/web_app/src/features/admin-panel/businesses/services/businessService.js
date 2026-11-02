import apiClient from "@/shared/api/apiClient";

/** Read the server-owned directory snapshot and PHT additions comparison. */
export async function fetchBusinessOverview({ signal } = {}) {
  const response = await apiClient.get("/admin/businesses/overview/", {
    signal,
  });

  return response.data.data;
}

export async function fetchBusinesses(params = {}) {
  const response = await apiClient.get("/admin/businesses/", {
    params,
  });

  return response.data.data;
}

export async function fetchBusinessLocations(params = {}) {
  const response = await apiClient.get("/admin/businesses/map/", {
    params,
  });

  return response.data.data;
}

export async function fetchBusiness(businessId) {
  const response = await apiClient.get(`/admin/businesses/${businessId}/`);

  return response.data.data;
}

export async function queueReviewInsightsRefresh(businessId) {
  const response = await apiClient.post(
    `/admin/businesses/${businessId}/review-insights/refresh/`,
  );

  return response.data;
}
