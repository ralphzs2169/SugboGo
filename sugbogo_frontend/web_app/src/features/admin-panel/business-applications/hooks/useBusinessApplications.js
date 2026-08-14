import { useEffect, useState } from "react";
import { fetchBusinessApplications } from "../services/businessApplicationService";

/**
 * Fetches and manages paginated business application data.
 *
 * Handles loading states, fetching states, API errors, pagination metadata,
 * and refetching applications when query parameters change.
 */
export default function useBusinessApplications(
  params = {},
  { enabled = true } = {},
) {
  const [applications, setApplications] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetches business applications using the current query parameters.
   *
   * Uses the initial loading state when no data exists yet and the
   * fetching state for subsequent requests.
   */
  async function loadBusinessApplications() {
    const initialLoad = applications.length === 0;

    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const response = await fetchBusinessApplications(params);

      setApplications(response.items ?? []);
      setTotalItems(response.pagination?.total_items ?? 0);
      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (error) {
      console.error("Failed to load business applications:", error);

      setError(error);
      setApplications([]);
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

    loadBusinessApplications();
  }, [
    enabled,
    params.search,
    params.status,
    params.queue_status,
    params.page,
    params.page_size,
    params.ordering,
  ]);

  return {
    applications,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadBusinessApplications,
  };
}
