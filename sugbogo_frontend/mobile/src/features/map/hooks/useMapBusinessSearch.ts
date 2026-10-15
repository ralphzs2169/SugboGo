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
  const enabled = isOpen && normalizedSearch.length >= 2 && !isDebouncing;
  const results = useDiscoveryResults(
    {
      search: debouncedSearch,
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    },
    enabled,
  );

  return {
    ...results,
    businesses: enabled ? results.businesses : [],
    error: enabled ? results.error : null,
    isPending:
      normalizedSearch.length >= 2 && (isDebouncing || results.isLoading),
    hasQuery: normalizedSearch.length >= 2,
  };
}
