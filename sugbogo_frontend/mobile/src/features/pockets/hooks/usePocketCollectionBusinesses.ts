import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getPocketCollectionBusinesses } from "../api/pockets.service";
import { pocketCollectionBusinessesQueryKey } from "./pocketQueryKeys";

/** Loads available saved businesses in membership order for one private collection. */
export default function usePocketCollectionBusinesses(
  collectionId: number | null | undefined,
) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const validCollectionId =
    typeof collectionId === "number" &&
    Number.isSafeInteger(collectionId) &&
    collectionId > 0
      ? collectionId
      : null;
  const isEnabled =
    isAuthenticated &&
    userId !== null &&
    !isAuthLoading &&
    validCollectionId !== null;

  const query = useInfiniteQuery({
    queryKey: pocketCollectionBusinessesQueryKey(
      isEnabled ? userId : null,
      validCollectionId,
    ),
    enabled: isEnabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (validCollectionId === null) {
        throw new Error("Select a valid Pocket.");
      }
      const session = useAuthStore.getState();
      if (
        !isEnabled ||
        !session.isAuthenticated ||
        session.isLoading ||
        session.user?.id !== userId
      ) {
        throw new Error("Sign in to view your Pockets.");
      }
      return throwOnApiError(
        await getPocketCollectionBusinesses(validCollectionId, pageParam),
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });

  const businesses = useMemo(() => {
    if (!isEnabled) return [];
    const seen = new Set<number>();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (business) => {
        if (seen.has(business.id)) return false;
        seen.add(business.id);
        return true;
      },
    );
  }, [isEnabled, query.data]);

  return {
    businesses,
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
