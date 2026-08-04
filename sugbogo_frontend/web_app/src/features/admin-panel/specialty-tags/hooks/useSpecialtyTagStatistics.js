import { useEffect, useState } from "react";
import { fetchSpecialtyTagStatistics } from "../services/specialtyTagService";

export default function useSpecialtyTagStatistics({ enabled = true } = {}) {
  const [statistics, setStatistics] = useState({
    totalTags: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadStatistics() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchSpecialtyTagStatistics();

      setStatistics({
        totalTags: response.total_tags ?? 0,
      });
    } catch (error) {
      console.error("Failed to load specialty tag statistics:", error);

      setError(error);
      setStatistics({
        totalTags: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadStatistics();
  }, [enabled]);

  return {
    statistics,
    isLoading,
    error,
    refetch: loadStatistics,
  };
}
