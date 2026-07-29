import { useEffect, useState } from "react";
import { fetchClusters } from "../services/clusterCategoryService";

export default function useClusters(params = {}) {
  const [clusters, setClusters] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadClusters() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchClusters(params);

      setClusters(response.items ?? []);

      setTotalItems(response.pagination?.total_items ?? 0);

      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (error) {
      console.error("Failed to load clusters:", error);

      setError(error);
      setClusters([]);
      setTotalItems(0);
      setPageCount(0);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadClusters();
  }, [params.search, params.page, params.page_size, params.ordering]);

  return {
    clusters,
    totalItems,
    pageCount,
    isLoading,
    error,
    refetch: loadClusters,
  };
}
