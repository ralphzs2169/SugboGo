import { useInfiniteQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getDiscoveryResults } from "../api/exploreBusiness.service";
import type { ExploreResultsCriteria } from "../types/exploreBusiness.types";

export const DISCOVERY_RESULTS_QUERY_KEY = ["explore-discovery-results"] as const;

export function normalizeCategoryIds(categoryIds: number[]) {
  return [...new Set(categoryIds)].sort((left, right) => left - right);
}

export function getDiscoveryResultsQueryKey(
  criteria: ExploreResultsCriteria,
) {
  return [
    ...DISCOVERY_RESULTS_QUERY_KEY,
    criteria.search.trim(),
    criteria.clusterId,
    normalizeCategoryIds(criteria.categoryIds),
    criteria.specialtyTagId,
  ] as const;
}

/** Loads backend-ranked discovery results without changing server order. */
export default function useDiscoveryResults(
  criteria: ExploreResultsCriteria,
) {
  const normalizedCriteria = {
    ...criteria,
    search: criteria.search.trim(),
    categoryIds: normalizeCategoryIds(criteria.categoryIds),
  };

  const query = useInfiniteQuery({
    queryKey: getDiscoveryResultsQueryKey(normalizedCriteria),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getDiscoveryResults(
        normalizedCriteria,
        pageParam,
      );

      return throwOnApiError(response);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.has_next) {
        return undefined;
      }

      return lastPage.pagination.page + 1;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalItems: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
