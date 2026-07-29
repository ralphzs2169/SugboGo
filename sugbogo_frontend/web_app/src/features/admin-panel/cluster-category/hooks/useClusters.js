import { useEffect, useState } from "react";
import { fetchClusters } from "../services/clusterCategoryService";

export default function useClusters(params = {}, { enabled = true } = {}) {
  const [clusters, setClusters] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [error, setError] = useState(null);

  async function loadClusters() {
    const initialLoad = clusters.length === 0;

    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

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
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadClusters();
  }, [enabled, params.search, params.page, params.page_size, params.ordering]);

  return {
    clusters,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadClusters,
  };
}
