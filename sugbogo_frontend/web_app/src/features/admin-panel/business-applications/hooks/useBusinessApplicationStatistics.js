import { useCallback, useEffect, useState } from "react";
import { fetchBusinessApplicationStatistics } from "../services/businessApplicationService";

/**
 * Fetches current review queue metrics and status totals for application management.
 */
export default function useBusinessApplicationStatistics({
  enabled = true,
} = {}) {
  const [statistics, setStatistics] = useState({
    pending_review: null,
    approaching_sla: null,
    overdue: null,
    oldest_pending_business_days: null,
    approved: null,
    rejected: null,
    total_applications: null,

    review_sla_business_days: 0,
    review_sla_approaching_business_days: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStatistics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchBusinessApplicationStatistics();

      setStatistics({
        pending_review: response.pending_review ?? null,
        approaching_sla: response.approaching_sla ?? null,
        overdue: response.overdue ?? null,
        oldest_pending_business_days:
          response.oldest_pending_business_days ?? null,
        approved: response.approved ?? null,
        rejected: response.rejected ?? null,
        total_applications: response.total_applications ?? null,

        review_sla_business_days: response.review_sla_business_days ?? 0,
        review_sla_approaching_business_days:
          response.review_sla_approaching_business_days ?? 0,
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

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        loadStatistics();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, loadStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: loadStatistics,
  };
}
