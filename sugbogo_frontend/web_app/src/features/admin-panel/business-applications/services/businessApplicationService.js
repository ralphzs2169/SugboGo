import apiClient from "@/shared/api/apiClient";

export async function fetchBusinessApplications(params = {}) {
  const response = await apiClient.get("/admin/businesses/applications/", {
    params,
  });

  return response.data.data;
}

export async function fetchBusinessApplication(applicationId) {
  const response = await apiClient.get(
    `/admin/businesses/applications/${applicationId}/`,
  );

  return response.data.data;
}
