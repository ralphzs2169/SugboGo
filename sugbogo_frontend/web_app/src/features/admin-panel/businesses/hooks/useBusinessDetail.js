import { BUSINESS_CHANGED_EVENT } from "../queries/businessResourceEvents";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const latestRequest = useRef(0);

  const loadBusiness = useCallback(async () => {
    if (!businessId) {
      return;
    }

    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchBusiness(businessId);

      if (requestId !== latestRequest.current) return;
      setBusiness(data);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      console.error("Failed to load business:", error);

      setError(error);
      setBusiness(null);
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Preserve the legacy hook's initial fetch; lifecycle updates use the event subscription below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBusiness();
    function refreshChangedBusiness(event) {
      if (String(event.detail.businessId) === String(businessId)) void loadBusiness();
    }
    window.addEventListener(BUSINESS_CHANGED_EVENT, refreshChangedBusiness);
    return () => {
      latestRequest.current += 1;
      window.removeEventListener(BUSINESS_CHANGED_EVENT, refreshChangedBusiness);
    };
  }, [enabled, loadBusiness, businessId]);

  return {
    business,
    isLoading,
    error,
    refetch: loadBusiness,
  };
}
