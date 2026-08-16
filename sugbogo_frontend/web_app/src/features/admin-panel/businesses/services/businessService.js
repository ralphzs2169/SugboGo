import apiClient from "@/shared/api/apiClient";

export async function fetchBusinesses(params = {}) {
  const response = await apiClient.get("/admin/businesses/", {
    params,
  });

  return response.data.data;
}
