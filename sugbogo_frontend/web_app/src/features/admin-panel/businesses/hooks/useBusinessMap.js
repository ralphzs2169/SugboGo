import { useEffect, useState } from "react";
import { fetchBusinessLocations } from "../services/businessService";

/**
 * Fetches business locations for the administrator business management map.
 *
 * Keeps map data independent from the paginated business management table
 * and exposes loading, error, and retry states to the page.
 */
export default function useBusinessMap({ enabled = true } = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadBusinessLocations() {
    const initialLoad = businesses.length === 0;

    if (initialLoad) {
      setIsLoading(true);
    }

    setError(null);

    try {
      const data = await fetchBusinessLocations();

      setBusinesses(data ?? []);
    } catch (error) {
      console.error("Failed to load business locations:", error);

      setError(error);
      setBusinesses([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadBusinessLocations();
  }, [enabled]);

  return {
    businesses,
    isLoading,
    error,
    refetch: loadBusinessLocations,
  };
}
