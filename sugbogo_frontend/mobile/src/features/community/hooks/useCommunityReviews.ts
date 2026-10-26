import {
  hashKey,
  type QueryClient,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getCommunityReviews } from "../api/communityReview.service";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../types/communityReview.types";
import { communityReviewsKey } from "./communityReviewQueryKeys";

const INITIAL_PAGE_PARAM = 1;
const COMMUNITY_STALE_TIME = 2 * 60 * 1000;
const HELPFUL_MUTATION_KEY = ["review-like"] as const;

type RefreshOperation = {
  queryHash: string;
  cancelled: boolean;
  stopWaiting: () => void;
  promise: Promise<void>;
};

/** Waits for existing optimistic Helpful writes before reading their server state. */
function waitForHelpfulMutations(client: QueryClient) {
  let stopWaiting = () => {};
  const promise = new Promise<void>((resolve) => {
    const unsubscribe = client.getMutationCache().subscribe(() => {
      if (client.isMutating({ mutationKey: HELPFUL_MUTATION_KEY }) === 0) {
        stopWaiting();
      }
    });

    stopWaiting = () => {
      unsubscribe();
      resolve();
    };

    if (client.isMutating({ mutationKey: HELPFUL_MUTATION_KEY }) === 0) {
      stopWaiting();
    }
  });

  return { promise, cancel: () => stopWaiting() };
}

/** Loads Community review pages while preserving the backend's stable order. */
export function useCommunityReviews(
  filters: CommunityReviewFilters = DEFAULT_COMMUNITY_REVIEW_FILTERS,
) {
  const client = useQueryClient();
  const refreshRef = useRef<RefreshOperation | null>(null);
  const [refreshingQueryHash, setRefreshingQueryHash] = useState<string | null>(
    null,
  );
  const queryOptions = {
    queryKey: communityReviewsKey(filters),
    initialPageParam: INITIAL_PAGE_PARAM,
    queryFn: async ({
      pageParam,
      signal,
    }: {
      pageParam: number;
      signal: AbortSignal;
    }): Promise<CommunityReviewListResponse> =>
      throwOnApiError(await getCommunityReviews(filters, pageParam, signal)),
    getNextPageParam: (lastPage: CommunityReviewListResponse) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    staleTime: COMMUNITY_STALE_TIME,
  };
  const queryHash = hashKey(queryOptions.queryKey);
  const query = useInfiniteQuery(queryOptions);

  useEffect(() => {
    return () => {
      const operation = refreshRef.current;

      if (operation?.queryHash === queryHash) {
        operation.cancelled = true;
        operation.stopWaiting();
        refreshRef.current = null;
        setRefreshingQueryHash(null);
        void client.cancelQueries({
          predicate: (cachedQuery) => cachedQuery.queryHash === queryHash,
        });
      }
    };
  }, [client, queryHash]);

  /** Replaces retained pages only after a fresh initial page succeeds. */
  const refresh = () => {
    if (refreshRef.current) {
      return refreshRef.current.promise;
    }

    const operation: RefreshOperation = {
      queryHash,
      cancelled: false,
      stopWaiting: () => {},
      promise: Promise.resolve(),
    };
    refreshRef.current = operation;
    setRefreshingQueryHash(queryHash);

    operation.promise = (async () => {
      try {
        await client.cancelQueries({
          queryKey: queryOptions.queryKey,
          exact: true,
        });

        do {
          if (operation.cancelled) {
            return;
          }

          const waiting = waitForHelpfulMutations(client);
          operation.stopWaiting = waiting.cancel;
          await waiting.promise;

          if (operation.cancelled) {
            return;
          }

          // Stop any automatic revalidation that started while Helpful was pending.
          await client.cancelQueries({
            queryKey: queryOptions.queryKey,
            exact: true,
          });
        } while (client.isMutating({ mutationKey: HELPFUL_MUTATION_KEY }) > 0);

        if (operation.cancelled) {
          return;
        }

        await client.fetchInfiniteQuery({
          ...queryOptions,
          pages: 1,
          staleTime: 0,
        });
      } catch {
        // The existing query owns genuine errors; cancellation restores its prior state.
      } finally {
        operation.stopWaiting();

        if (refreshRef.current === operation) {
          refreshRef.current = null;
          setRefreshingQueryHash(null);
        }
      }
    })();

    return operation.promise;
  };

  const fetchNextPage = () => {
    if (refreshRef.current) {
      return refreshRef.current.promise;
    }

    return query.fetchNextPage();
  };

  const reviews = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return {
    reviews,
    hasData: query.data !== undefined,
    isSuccess: query.isSuccess,
    isPaused: query.isPaused,
    pages: query.data?.pages ?? [],
    totalCount: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasNextPage: query.hasNextPage,
    fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,

    isLoading: query.isLoading,
    isInitialLoading: query.isLoading && !query.isFetched,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isRefreshing: refreshingQueryHash === queryHash,
    refresh,

    error: query.error,
    refetch: query.refetch,
  };
}

export default useCommunityReviews;
