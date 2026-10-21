import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getActivityTimeline } from "../api/activityTimeline.service";
import type { ActivityFilter } from "../types/activityTimeline.types";
import { activityTimelineKey } from "./activityTimelineQueryKeys";

/** Loads account-scoped activity without changing backend ordering or filtering. */
export default function useActivityTimeline(activityType: ActivityFilter) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isEnabled = isAuthenticated && userId !== null && !isAuthLoading;
  const query = useInfiniteQuery({
    queryKey: activityTimelineKey(isEnabled ? userId : null, activityType),
    enabled: isEnabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!isEnabled) {
        throw new Error("Sign in to view your activity.");
      }
      return throwOnApiError(
        await getActivityTimeline(activityType, pageParam),
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });
  const activities = useMemo(() => {
    if (!isEnabled) {
      return [];
    }
    // Concurrent writes can shift page boundaries; preserve the first occurrence.
    const seen = new Set<string>();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (activity) => {
        if (seen.has(activity.id)) {
          return false;
        }
        seen.add(activity.id);
        return true;
      },
    );
  }, [isEnabled, query.data]);

  return { ...query, activities, userId, isEnabled, isAuthLoading };
}
