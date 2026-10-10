import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getCommunityReviews } from "../api/communityReview.service";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../types/communityReview.types";
import { communityReviewsKey } from "./communityReviewQueryKeys";

/** Loads Community review pages while preserving the backend's stable order. */
export function useCommunityReviews(
  filters: CommunityReviewFilters = DEFAULT_COMMUNITY_REVIEW_FILTERS,
) {
  const query = useInfiniteQuery({
    queryKey: communityReviewsKey(filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CommunityReviewListResponse> =>
      throwOnApiError(await getCommunityReviews(filters, pageParam)),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next
        ? lastPage.pagination.page + 1
        : undefined,
    placeholderData: keepPreviousData,
  });

  return {
    reviews: query.data?.pages.flatMap((page) => page.items) ?? [],
    pages: query.data?.pages ?? [],
    totalCount: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    isPlaceholderData: query.isPlaceholderData,

    isLoading: query.isLoading,
    isInitialLoading: query.isLoading && !query.isFetched,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,

    error: query.error,
    refetch: query.refetch,
  };
}

export default useCommunityReviews;
