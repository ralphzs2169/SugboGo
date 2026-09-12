import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getExploreFilterOptions } from "../api/exploreBusiness.service";

export const EXPLORE_FILTER_OPTIONS_QUERY_KEY = [
  "explore-filter-options",
] as const;

/** Loads authoritative taxonomy choices for Explorer search and filtering. */
export default function useExploreFilterOptions() {
  const query = useQuery({
    queryKey: EXPLORE_FILTER_OPTIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getExploreFilterOptions();

      return throwOnApiError(response);
    },
    staleTime: 30 * 60 * 1000,
  });

  return {
    options: query.data ?? {
      clusters: [],
      categories: [],
      specialty_tags: [],
    },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
