import { fetchActivityLog, fetchActivityLogs } from "../services/activityLogService";

export const activityLogKeys = {
  list: (params) => ["admin", "activity-logs", "list", params],
  detail: (eventId) => ["admin", "activity-logs", "detail", eventId],
};

/** Keep filter/page caches separate and let the shared QueryClient own retry behavior. */
export function activityLogListOptions(params) {
  return {
    queryKey: activityLogKeys.list(params),
    queryFn: ({ signal }) => fetchActivityLogs(params, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  };
}

/** Revalidate selected occurrences on reopen so removed or expired sources are handled normally. */
export function activityLogDetailOptions(eventId) {
  return {
    queryKey: activityLogKeys.detail(eventId),
    queryFn: ({ signal }) => fetchActivityLog(eventId, { signal }),
    enabled: typeof eventId === "string" && eventId.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  };
}
