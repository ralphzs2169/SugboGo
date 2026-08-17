import { useCallback, useEffect, useState } from "react";
import { fetchBusiness } from "../services/businessService";

/**
 * Fetches the complete administrator-facing details for a single business.
 *
 * Owns the request lifecycle so the business detail page can present
 * loading, error, and retry states without managing API state itself.
 */
export default function useBusinessDetail(businessId, { enabled = true } = {}) {
  const [business, setBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBusiness = useCallback(async () => {
    if (!businessId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchBusiness(businessId);

      setBusiness(data);
    } catch (error) {
      console.error("Failed to load business:", error);

      setError(error);
      setBusiness(null);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusiness();
  }, [enabled, loadBusiness]);

  return {
    business,
    isLoading,
    error,
    refetch: loadBusiness,
  };
}
