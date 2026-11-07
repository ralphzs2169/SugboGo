import { useQuery } from "@tanstack/react-query";

import useDebounce from "@/shared/hooks/useDebounce";
import { fetchGlobalSearch } from "../services/globalSearchService";

/** Debounce valid searches while detaching closed or superseded request observers. */
export default function useGlobalSearch(input, { enabled = false } = {}) {
  const search = enabled ? input.trim() : "";
  const debouncedSearch = useDebounce(search);
  const isValid = search.length >= 2 && search.length <= 200;
  const isDebouncing = search !== debouncedSearch;
  const ready = enabled && isValid && !isDebouncing;
  const params = { search, limit_per_type: 3 };
  const query = useQuery({
    // Key the current input immediately so changing or dismissing it aborts the old read.
    queryKey: ["admin", "global-search", params],
    queryFn: ({ signal }) => fetchGlobalSearch(params, { signal }),
    enabled: ready,
    staleTime: 30_000,
  });

  return {
    groups:
      ready && query.data?.search === search && !query.isError
        ? query.data.groups
        : [],
    isLoading:
      enabled && isValid &&
      (isDebouncing || query.isPending || query.isFetching),
    error: ready ? query.error : null,
    refetch: query.refetch,
  };
}
