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

export async function fetchBusinessApplicationDocumentPreview(
  applicationId,
  documentId,
) {
  const response = await apiClient.get(
    `/admin/businesses/applications/${applicationId}/documents/${documentId}/preview/`,
    {
      responseType: "blob",
    },
  );

  return response.data;
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

/** Reads live duplicate candidates without changing the application. */
export async function fetchApplicationDuplicates(applicationId) {
  const response = await apiClient.get(
    `/admin/businesses/applications/${applicationId}/duplicates/`,
  );
  return response.data.data;
}

/** Records an assessment or reconsideration against current evidence. */
export async function saveApplicationDuplicateReview(applicationId, payload) {
  const response = await apiClient.post(
    `/admin/businesses/applications/${applicationId}/duplicates/`,
    payload,
  );
  return response.data.data;
}

/** Rejects a confirmed duplicate without fabricating section corrections. */
export async function rejectDuplicateApplication(applicationId, explanation) {
  const response = await apiClient.post(
    `/admin/businesses/applications/${applicationId}/reject/`,
    { disposition: "duplicate", explanation },
  );
  return response.data.data;
}
