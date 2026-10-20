import type { ActivityFilter } from "../types/activityTimeline.types";

export const ACTIVITY_TIMELINE_QUERY_KEY = ["activity-timeline"] as const;

/** Separates private account histories and server-filtered page collections. */
export function activityTimelineKey(
  userId: number | null,
  activityType: ActivityFilter,
) {
  return [...ACTIVITY_TIMELINE_QUERY_KEY, userId, activityType] as const;
}
