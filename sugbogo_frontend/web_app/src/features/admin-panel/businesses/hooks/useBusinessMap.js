import { useEffect, useState } from "react";
import { fetchBusinessLocations } from "../services/businessService";

/**
 * Fetches business locations for the administrator business management map.
 *
 * Mirrors the search/status filters applied to the paginated business
 * management table, so the map reflects the same filtered subset.
 * Exposes loading, error, and retry states to the page.
 */
export default function useBusinessMap({
  enabled = true,
  search,
  status,
} = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  async function loadBusinessLocations() {
    const initialLoad = businesses.length === 0;

    if (initialLoad) setIsLoading(true);
    setIsFetching(true);
    setError(null);

    try {
      const data = await fetchBusinessLocations({ search, status });

      setBusinesses(data ?? []);
    } catch (error) {
      console.error("Failed to load business locations:", error);

      setError(error);
      setBusinesses([]);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinessLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, search, status]);

  return {
    businesses,
    isLoading,
    isFetching,
    error,
    refetch: loadBusinessLocations,
  };
}
