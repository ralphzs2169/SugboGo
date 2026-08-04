import apiClient from "@/shared/api/apiClient";

export async function fetchSpecialtyTags(params = {}) {
  const response = await apiClient.get("/admin/msmes/specialty-tags/", {
    params,
  });

  return response.data.data;
}

export async function createSpecialtyTag(payload) {
  const response = await apiClient.post(
    "/admin/msmes/specialty-tags/",
    payload,
  );

  return response.data.data;
}

export async function updateSpecialtyTag(tagId, payload) {
  const response = await apiClient.patch(
    `/admin/msmes/specialty-tags/${tagId}/`,
    payload,
  );

  return response.data.data;
}

export async function deleteSpecialtyTag(tagId) {
  const response = await apiClient.delete(
    `/admin/msmes/specialty-tags/${tagId}/`,
  );

  return response.data;
}
