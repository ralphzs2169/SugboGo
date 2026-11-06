import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/activity-logs/";

/** Read a server-filtered activity page through the shared authenticated client. */
export async function fetchActivityLogs(
  params,
  { signal } = {},
) {
  const response = await apiClient.get(BASE_URL, { params, signal });
  return response.data.data;
}

/** Encode the full composite occurrence identity as one detail URL segment. */
export async function fetchActivityLog(
  eventId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `${BASE_URL}${encodeURIComponent(eventId)}/`,
    { signal },
  );
  return response.data.data;
}
