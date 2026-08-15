import { useEffect, useState } from "react";
import { fetchClusterCategorySummary } from "../services/clusterCategoryService";

export default function useClusterCategorySummary() {
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    clusterCount: 0,
    categoryCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  async function loadSummary() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchClusterCategorySummary();

      setSummary({
        clusterCount: response.cluster_count ?? 0,
        categoryCount: response.category_count ?? 0,
      });
    } catch (error) {
      console.error("Failed to load cluster/category summary:", error);

      setError(error);

      setSummary({
        clusterCount: 0,
        categoryCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  return {
    summary,
    isLoading,
    error,
    refetch: loadSummary,
  };
}
