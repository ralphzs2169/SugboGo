import { useEffect, useState } from "react";
import { fetchClusters } from "../services/clusterCategoryService";

/**
 * Handles fetching and managing cluster data.
 *
 * Owns the fetch lifecycle state including loading
 * and manual refetching.
 *
 * @returns {{
 *   clusters: Array,
 *   isLoading: boolean,
 *   refetch: Function
 * }}
 */
export default function useClusters() {
  const [clusters, setClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadClusters() {
    setIsLoading(true);

    try {
      const response = await fetchClusters();

      setClusters(response.items);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadClusters();
  }, []);

  return {
    clusters,
    isLoading,
    refetch: loadClusters,
  };
}
