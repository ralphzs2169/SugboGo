import apiClient from "@/shared/api/apiClient";

export async function fetchSpecialtyTags(params = {}) {
  const response = await apiClient.get("/admin/taxonomy/specialty-tags/", {
    params,
  });

  return response.data.data;
}

export async function fetchSpecialtyTagStatistics() {
  const response = await apiClient.get(
    "/admin/taxonomy/specialty-tags/statistics/",
  );

  return response.data.data;
}

export async function createSpecialtyTag(payload) {
  const response = await apiClient.post(
    "/admin/taxonomy/specialty-tags/",
    payload,
  );

  return response.data.data;
}

export async function updateSpecialtyTag(tagId, payload) {
  const response = await apiClient.patch(
    `/admin/taxonomy/specialty-tags/${tagId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteSpecialtyTag(tagId) {
  const response = await apiClient.delete(
    `/admin/taxonomy/specialty-tags/${tagId}/`,
  );

  return response.data;
}
