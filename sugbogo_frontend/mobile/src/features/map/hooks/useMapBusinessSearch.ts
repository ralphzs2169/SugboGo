import { useEffect, useState } from "react";

import useDiscoveryResults from "@/features/explore/hooks/useDiscoveryResults";

/** Debounces global registered-business search while sharing Explore's query cache. */
export default function useMapBusinessSearch(search: string, isOpen: boolean) {
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const normalizedSearch = search.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, 350);

    return () => clearTimeout(timeout);
  }, [normalizedSearch]);

  const isDebouncing = normalizedSearch !== debouncedSearch;
  const hasQuery = normalizedSearch.length > 0;
  const enabled = isOpen && hasQuery && !isDebouncing;
  const results = useDiscoveryResults(
    {
      search: debouncedSearch,
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    },
    enabled,
  );

  const isActive = isOpen && hasQuery;
  const isInitialLoading = enabled && results.isLoading;
  const isUpdating =
    isActive &&
    !isInitialLoading &&
    !results.isPaused &&
    (isDebouncing ||
      results.isPlaceholderData ||
      (results.isFetching && !results.isFetchingNextPage));

  return {
    ...results,
    businesses: isActive ? results.businesses : [],
    error: enabled ? results.error : null,
    isInitialLoading,
    isUpdating,
    isPending:
      isActive &&
      (isDebouncing ||
        (!results.isPaused &&
          (results.isLoading || results.isPlaceholderData))),
    hasQuery,
  };
}
