import apiClient from "@/shared/api/apiClient";

// Cluster API Services

export async function fetchClusters(params = {}) {
  const response = await apiClient.get("/admin/msmes/clusters/", { params });

  return response.data.data;
}

export async function createCluster(payload) {
  const response = await apiClient.post("/admin/msmes/clusters/", payload);

  return response.data.data;
}

export async function updateCluster(clusterId, payload) {
  const response = await apiClient.patch(
    `/admin/msmes/clusters/${clusterId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCluster(clusterId) {
  const response = await apiClient.delete(
    `/admin/msmes/clusters/${clusterId}/`,
  );

  return response.data;
}

// Category API Services

export async function fetchCategories(params = {}) {
  const response = await apiClient.get("/admin/msmes/categories/", { params });

  return response.data.data;
}

export async function createCategory(payload) {
  const response = await apiClient.post("/admin/msmes/categories/", payload);

  return response.data.data;
}

export async function updateCategory(categoryId, payload) {
  const response = await apiClient.patch(
    `/admin/msmes/categories/${categoryId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCategory(categoryId) {
  const response = await apiClient.delete(
    `/admin/msmes/categories/${categoryId}/`,
  );

  return response.data;
}

// Summary API Services

export async function fetchClusterCategorySummary() {
  const response = await apiClient.get(
    "/admin/msmes/cluster-category/summary/",
  );
  return response.data.data;
}
