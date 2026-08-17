import { useEffect, useState } from "react";
import { fetchBusinesses } from "../services/businessService";

/**
 * Fetches and manages paginated business data for the admin management table.
 *
 * Handles loading states, fetching states, API errors, pagination metadata,
 * and refetching businesses when query parameters change.
 */
export default function useBusinesses(params = {}, { enabled = true } = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetches businesses using the current query parameters.
   *
   * Uses the initial loading state when no data exists yet and the
   * fetching state for subsequent requests.
   */
  async function loadBusinesses() {
    const initialLoad = businesses.length === 0;

    if (initialLoad) {
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
      setIsLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinesses();
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
