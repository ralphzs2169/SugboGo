import { useEffect, useRef, useState } from "react";
import { fetchBusinesses } from "../services/businessService";

/**
 * Fetches businesses for the administrator business management table.
 * Mirrors the search/status filters, sorting, and pagination applied to the table,
 * so the table reflects the same filtered subset. Exposes loading, error, and retry
 * states to the page.
 */
export default function useBusinesses(params = {}, { enabled = true } = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const hasLoadedOnce = useRef(false);

  async function loadBusinesses() {
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const response = await fetchBusinesses(params);

      setBusinesses(response.items ?? []);
      setTotalItems(response.pagination?.total_items ?? 0);
      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (error) {
      console.error("Failed to load businesses:", error);

      setError(error);
      setBusinesses([]);
      setTotalItems(0);
      setPageCount(0);
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    params.search,
    params.status,
    params.page,
    params.page_size,
    params.ordering,
  ]);

  return {
    businesses,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadBusinesses,
  };
}
