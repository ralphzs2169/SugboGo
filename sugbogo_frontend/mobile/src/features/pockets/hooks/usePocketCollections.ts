import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getPocketCollections } from "../api/pockets.service";
import { pocketCollectionsQueryKey } from "./pocketQueryKeys";

/** Loads private collection pages without sharing data or requests between accounts. */
export default function usePocketCollections() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isEnabled = isAuthenticated && userId !== null && !isAuthLoading;

  const query = useInfiniteQuery({
    queryKey: pocketCollectionsQueryKey(isEnabled ? userId : null),
    enabled: isEnabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const session = useAuthStore.getState();
      // Manual refetches and retries must still belong to this query's owner.
      if (
        !isEnabled ||
        !session.isAuthenticated ||
        session.isLoading ||
        session.user?.id !== userId
      ) {
        throw new Error("Sign in to view your Pockets.");
      }
      return throwOnApiError(await getPocketCollections(pageParam));
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });

  const collections = useMemo(() => {
    if (!isEnabled) return [];
    const seen = new Set<number>();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (collection) => {
        if (seen.has(collection.id)) return false;
        seen.add(collection.id);
        return true;
      },
    );
  }, [isEnabled, query.data]);

  return {
    collections,
    totalCount: isEnabled
      ? (query.data?.pages[0]?.pagination.total_items ?? 0)
      : 0,
    hasData: isEnabled && query.data !== undefined,
    userId,
    isEnabled,
    isAuthLoading,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}
