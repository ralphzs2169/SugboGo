import apiClient from "@/shared/api/apiClient";

// Cluster API Services

export async function fetchClusters(params = {}) {
  const response = await apiClient.get("/admin/msmes/clusters/", { params });

  return response.data.data;
}

export async function createCluster(payload) {
  const response = await apiClient.post(
    "/admin/msmes/clusters/create/",
    payload,
  );

  return response.data.data;
}

export async function updateCluster(clusterId, payload) {
  const response = await apiClient.patch(
    `/admin/msmes/clusters/${clusterId}/update/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCluster(clusterId) {
  const response = await apiClient.delete(
    `/admin/msmes/clusters/${clusterId}/delete/`,
  );

  return response.data;
}

// Category API Services

export async function fetchCategories(params = {}) {
  const response = await apiClient.get("/admin/msmes/categories/", { params });

  return response.data.data;
}

export async function createCategory(payload) {
  const response = await apiClient.post(
    "/admin/msmes/categories/create/",
    payload,
  );

  return response.data.data;
}

export async function updateCategory(categoryId, payload) {
  const response = await apiClient.patch(
    `/admin/msmes/categories/${categoryId}/update/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCategory(categoryId) {
  const response = await apiClient.delete(
    `/admin/msmes/categories/${categoryId}/delete/`,
  );

  return response.data;
}
