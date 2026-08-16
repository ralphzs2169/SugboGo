import apiClient from "@/shared/api/apiClient";

export async function fetchBusinesses(params = {}) {
  const response = await apiClient.get("/admin/businesses/", {
    params,
  });

  return response.data.data;
}

export async function fetchBusinessLocations() {
  const response = await apiClient.get("/admin/businesses/map/");

  return response.data.data;
}

export async function fetchBusiness(businessId) {
  const response = await apiClient.get(`/admin/businesses/${businessId}/`);

  return response.data.data;
}
