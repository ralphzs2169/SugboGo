import apiClient from "@/shared/api/apiClient";

export async function fetchDiscoveryScores(params = {}) {
  const response = await apiClient.get("/admin/analytics/discovery-scores/", {
    params,
  });
  return response.data.data;
}

export async function recomputeDiscoveryScores() {
  const response = await apiClient.post(
    "/admin/analytics/discovery-scores/recompute/",
  );
  return response.data.data;
}
