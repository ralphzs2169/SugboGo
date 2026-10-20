import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  ActivityFilter,
  ActivityTimelinePage,
} from "../types/activityTimeline.types";

/** Retrieves one server-ordered page of the authenticated account's activity. */
export function getActivityTimeline(
  activityType: ActivityFilter,
  page: number,
): Promise<ApiResponse<ActivityTimelinePage>> {
  return request(
    apiClient.get("/explorer/explore/activity-timeline/", {
      params: { activity_type: activityType, page },
    }),
  );
}
