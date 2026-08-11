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

export async function fetchBusinessApplicationStatistics() {
  const response = await apiClient.get(
    "/admin/businesses/applications/statistics/",
  );

  return response.data.data;
}

export async function approveBusinessApplication(applicationId) {
  const response = await apiClient.post(
    `/admin/businesses/applications/${applicationId}/approve/`,
  );

  return response.data.data;
}

export async function rejectBusinessApplication(applicationId, feedback) {
  const response = await apiClient.post(
    `/admin/businesses/applications/${applicationId}/reject/`,
    {
      feedback,
    },
  );

  return response.data.data;
}
