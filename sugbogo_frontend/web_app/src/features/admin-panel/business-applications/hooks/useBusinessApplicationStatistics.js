import { useCallback, useEffect, useState } from "react";
import { fetchBusinessApplicationStatistics } from "../services/businessApplicationService";

/**
 * Fetches aggregate business application statistics for the
 * administrator application management page.
 */
export default function useBusinessApplicationStatistics({
  enabled = true,
} = {}) {
  const [statistics, setStatistics] = useState({
    pending_review: 0,
    approved: 0,
    rejected: 0,
    total_applications: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStatistics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchBusinessApplicationStatistics();

      setStatistics({
        pending_review: response.pending_review ?? 0,
        approved: response.approved ?? 0,
        rejected: response.rejected ?? 0,
        total_applications: response.total_applications ?? 0,
      });
    } catch (error) {
      console.error("Failed to load business application statistics:", error);

      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadStatistics();
  }, [enabled, loadStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: loadStatistics,
  };
}
