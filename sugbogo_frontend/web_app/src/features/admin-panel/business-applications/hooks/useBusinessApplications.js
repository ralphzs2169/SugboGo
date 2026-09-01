import { useEffect, useRef, useState } from "react";
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

  const hasLoadedOnce = useRef(false);

  /**
   * Fetches business applications using the current query parameters.
   *
   * Uses the initial loading state on the very first load and the
   * fetching state for subsequent requests.
   */
  async function loadBusinessApplications() {
    if (!hasLoadedOnce.current) {
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
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinessApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(params)]);

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
