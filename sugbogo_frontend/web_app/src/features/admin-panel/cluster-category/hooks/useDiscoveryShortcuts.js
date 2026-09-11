import { useEffect, useState } from "react";

import { fetchDiscoveryShortcuts } from "../services/clusterCategoryService";

export default function useDiscoveryShortcuts(params = {}, { enabled = true } = {}) {
  const [shortcuts, setShortcuts] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  async function loadShortcuts() {
    if (shortcuts.length === 0) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const response = await fetchDiscoveryShortcuts(params);

      setShortcuts(response.items ?? []);
      setTotalItems(response.pagination?.total_items ?? 0);
      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (loadError) {
      setError(loadError);
      setShortcuts([]);
      setTotalItems(0);
      setPageCount(0);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (enabled) {
      // Match the existing non-React-Query admin CRUD hooks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadShortcuts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, params.search, params.page, params.page_size, params.ordering]);

  return {
    shortcuts,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadShortcuts,
  };
}
