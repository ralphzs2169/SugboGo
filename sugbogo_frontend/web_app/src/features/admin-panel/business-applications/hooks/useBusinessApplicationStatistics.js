import { useCallback, useEffect, useState } from "react";
import { fetchBusinessApplicationStatistics } from "../services/businessApplicationService";

/**
 * Fetches aggregate business application statistics and analytics
 * for the administrator application management page.
 *
 * Normalizes optional analytics values so the dashboard can safely
 * render while data is loading or when a trend has insufficient data.
 */
export default function useBusinessApplicationStatistics({
  enabled = true,
} = {}) {
  const [statistics, setStatistics] = useState({
    pending_review: 0,
    approved: 0,
    rejected: 0,
    total_applications: 0,

    approval_rate: null,
    resubmission_rate: null,
    sla_compliance_rate: null,

    approval_rate_trend: null,
    resubmission_rate_trend: null,
    pending_review_trend: null,
    sla_compliance_rate_trend: null,

    pending_review_history: [],
    approval_rate_history: [],
    resubmission_rate_history: [],
    sla_compliance_rate_history: [],

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
        pending_review: response.pending_review ?? 0,
        approved: response.approved ?? 0,
        rejected: response.rejected ?? 0,
        total_applications: response.total_applications ?? 0,

        approval_rate: response.approval_rate ?? null,
        resubmission_rate: response.resubmission_rate ?? null,
        sla_compliance_rate: response.sla_compliance_rate ?? null,

        approval_rate_trend: response.approval_rate_trend ?? null,
        resubmission_rate_trend: response.resubmission_rate_trend ?? null,
        pending_review_this_week: response.pending_review_this_week ?? null,
        sla_compliance_rate_trend: response.sla_compliance_rate_trend ?? null,

        pending_review_history: response.pending_review_history ?? [],
        approval_rate_history: response.approval_rate_history ?? [],
        resubmission_rate_history: response.resubmission_rate_history ?? [],
        sla_compliance_rate_history: response.sla_compliance_rate_history ?? [],

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

    loadStatistics();
  }, [enabled, loadStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: loadStatistics,
  };
}
