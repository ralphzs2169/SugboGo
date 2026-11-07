import apiClient from "@/shared/api/apiClient";

/** Read compact Admin search groups through the existing session-aware client. */
export async function fetchGlobalSearch(params, { signal } = {}) {
  const response = await apiClient.get("/admin/search/", {
    params,
    signal,
  });

  return response.data.data;
}
