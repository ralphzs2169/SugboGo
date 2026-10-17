import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getVouchHistory } from "../api/vouchHistory.service";
import type { VouchHistoryOrdering } from "../types/vouchHistory.types";
import { vouchHistoryQueryKey } from "./vouchHistoryQueryKeys";

/** Loads business history pages and full totals without changing backend order. */
export default function useVouchHistory(ordering: VouchHistoryOrdering) {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: vouchHistoryQueryKey(userId, ordering),
    enabled: Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(await getVouchHistory(ordering, pageParam)),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });

  return {
    businesses: query.data?.pages.flatMap((page) => page.items) ?? [],
    summary: query.data?.pages[0]?.summary ?? null,
    hasData: query.data !== undefined,
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
