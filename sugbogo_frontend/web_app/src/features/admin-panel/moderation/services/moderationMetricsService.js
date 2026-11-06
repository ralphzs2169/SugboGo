import apiClient from "@/shared/api/apiClient";

/** Read the authoritative summary independently of the visible queue filters. */
export async function fetchModerationMetrics(tab) {
  const response = await apiClient.get("/admin/moderation/summary/", {
    params: { tab },
  });
  return response.data.data;
}
