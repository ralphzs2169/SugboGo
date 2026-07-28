import apiClient from "@/shared/api/apiClient";

export async function fetchClusters(params = {}) {
  const response = await apiClient.get("/admin/msmes/clusters/", { params });

  return response.data.data;
}

export async function fetchCategories(params = {}) {
  const response = await apiClient.get("/admin/msmes/categories/", { params });

  return response.data.data;
}
