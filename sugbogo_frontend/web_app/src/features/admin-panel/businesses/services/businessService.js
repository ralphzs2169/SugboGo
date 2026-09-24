import apiClient from "@/shared/api/apiClient";

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
