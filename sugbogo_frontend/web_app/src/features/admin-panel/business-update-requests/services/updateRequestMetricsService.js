import apiClient from "@/shared/api/apiClient";

/** Load a full-queue summary for the selected type and business scope. */
export async function fetchUpdateRequestMetrics(params) {
  const response = await apiClient.get("/admin/businesses/update-requests/summary/", {
    params,
  });
  return response.data.data;
}

export const updateRequestSummaryKey = ["admin", "update-request-summary"];
