import { BUSINESS_CHANGED_EVENT } from "../queries/businessResourceEvents";
import { useEffect, useRef, useState } from "react";
import { fetchBusinessLocations } from "../services/businessService";

/**
 * Fetches business locations for the administrator business management map.
 *
 * Mirrors the search, status, cluster, category, and specialty tag filters
 * applied to the paginated business management table, so the map reflects
 * the same filtered subset. Exposes loading, error, and retry states.
 */
export default function useBusinessMap({
  enabled = true,
  search,
  status,
  cluster,
  category,
  specialtyTag,
} = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const hasLoadedOnce = useRef(false);
  const latestRequest = useRef(0);

  async function loadBusinessLocations() {
    const requestId = ++latestRequest.current;
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const data = await fetchBusinessLocations({
        search,
        status,
        cluster,
        category,
        specialty_tag: specialtyTag,
      });

      // Ignore requests superseded by a filter change or lifecycle refresh.
      if (requestId !== latestRequest.current) return;
      setBusinesses(data ?? []);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      console.error("Failed to load business locations:", error);

      setError(error);
      setBusinesses([]);
    } finally {
      if (requestId === latestRequest.current) {
        hasLoadedOnce.current = true;
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Preserve the legacy hook's initial fetch; lifecycle updates use the event subscription below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBusinessLocations();
    window.addEventListener(BUSINESS_CHANGED_EVENT, loadBusinessLocations);
    return () => {
      latestRequest.current += 1;
      window.removeEventListener(BUSINESS_CHANGED_EVENT, loadBusinessLocations);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, search, status, cluster, category, specialtyTag]);

  return {
    businesses,
    isLoading,
    isFetching,
    error,
    refetch: loadBusinessLocations,
  };
}
