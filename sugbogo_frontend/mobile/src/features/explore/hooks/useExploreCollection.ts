import { useInfiniteQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getExploreCollection } from "../api/exploreBusiness.service";
import type {
  ExploreCollectionCriteria,
  ExploreCollectionType,
} from "../types/exploreBusiness.types";
import { normalizeCategoryIds } from "./useDiscoveryResults";

export const EXPLORE_COLLECTIONS_QUERY_KEY = ["explore-collections"] as const;

export function getExploreCollectionQueryKey(
  collectionType: ExploreCollectionType,
  criteria: ExploreCollectionCriteria,
) {
  return [
    ...EXPLORE_COLLECTIONS_QUERY_KEY,
    collectionType,
    criteria.clusterId,
    normalizeCategoryIds(criteria.categoryIds),
    criteria.specialtyTagId,
  ] as const;
}

/** Loads one filtered collection while preserving backend page order. */
export default function useExploreCollection(
  collectionType: ExploreCollectionType | null,
  criteria: ExploreCollectionCriteria,
) {
  const normalizedCriteria = {
    ...criteria,
    categoryIds: normalizeCategoryIds(criteria.categoryIds),
  };
  const query = useInfiniteQuery({
    queryKey: getExploreCollectionQueryKey(
      collectionType ?? "worth-discovering",
      normalizedCriteria,
    ),
    enabled: collectionType !== null,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getExploreCollection(
        collectionType ?? "worth-discovering",
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
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
