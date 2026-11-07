import { useQuery } from "@tanstack/react-query";
import { activityLogDetailOptions, activityLogListOptions } from "../queries/activityLogQueries";

/** Expose list data, loading, errors, and retry without issuing UI notifications in the data layer. */
export function useActivityLogs(params) {
  return useQuery(activityLogListOptions(params));
}

/** Isolate detail loading and failure from the current activity page. */
export function useActivityLog(eventId) {
  return useQuery(activityLogDetailOptions(eventId));
}
