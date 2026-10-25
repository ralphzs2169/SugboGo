import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getExploreFilterOptions } from "../api/exploreBusiness.service";
import {
  EXPLORE_FILTER_OPTIONS_QUERY_KEY,
  EXPLORE_FILTER_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { EXPLORE_FILTER_OPTIONS_QUERY_KEY } from "../constants/exploreHomepageQueries";

/** Loads authoritative taxonomy choices for Explorer search and filtering. */
export default function useExploreFilterOptions() {
  const query = useQuery({
    queryKey: EXPLORE_FILTER_OPTIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getExploreFilterOptions();

      return throwOnApiError(response);
    },
    gcTime: EXPLORE_FILTER_RETENTION_MS,
    staleTime: 30 * 60 * 1000,
  });

  return {
    options: query.data ?? {
      clusters: [],
      categories: [],
      specialty_tags: [],
    },
    isLoading: query.isLoading,
    hasOptions: query.data !== undefined,
    isPaused: query.fetchStatus === "paused",
    error: query.error,
    refetch: query.refetch,
  };
}
