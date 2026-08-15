import apiClient from "@/shared/api/apiClient";

// Cluster API Services

export async function fetchClusters(params = {}) {
  const response = await apiClient.get("/admin/taxonomy/clusters/", {
    params,
  });

  return response.data.data;
}

export async function fetchClusterStatistics() {
  const response = await apiClient.get("/admin/taxonomy/clusters/statistics/");

  return response.data.data;
}

export async function createCluster(payload) {
  const response = await apiClient.post("/admin/taxonomy/clusters/", payload);

  return response.data.data;
}

export async function updateCluster(clusterId, payload) {
  const response = await apiClient.patch(
    `/admin/taxonomy/clusters/${clusterId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCluster(clusterId) {
  const response = await apiClient.delete(
    `/admin/taxonomy/clusters/${clusterId}/`,
  );

  return response.data;
}

// Category API Services

export async function fetchCategories(params = {}) {
  const response = await apiClient.get("/admin/taxonomy/categories/", {
    params,
  });

  return response.data.data;
}

export async function fetchCategoryStatistics() {
  const response = await apiClient.get(
    "/admin/taxonomy/categories/statistics/",
  );

  return response.data.data;
}

export async function createCategory(payload) {
  const response = await apiClient.post("/admin/taxonomy/categories/", payload);

  return response.data.data;
}

export async function updateCategory(categoryId, payload) {
  const response = await apiClient.patch(
    `/admin/taxonomy/categories/${categoryId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteCategory(categoryId) {
  const response = await apiClient.delete(
    `/admin/taxonomy/categories/${categoryId}/`,
  );

  return response.data;
}

// Summary API Services

export async function fetchClusterCategorySummary() {
  const response = await apiClient.get(
    "/admin/taxonomy/cluster-category/summary/",
  );
  return response.data.data;
}
