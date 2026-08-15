import { useCallback, useEffect, useState } from "react";

import { fetchCategoryStatistics } from "../services/clusterCategoryService";

/**
 * Fetches category management statistics and exposes loading,
 * error, and retry state for the page.
 */
export default function useCategoryStatistics() {
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatistics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchCategoryStatistics();
      setStatistics(data);
    } catch (error) {
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}
