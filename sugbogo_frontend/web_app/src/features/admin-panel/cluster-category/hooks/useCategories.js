import { useEffect, useState } from "react";
import { fetchCategories } from "../services/clusterCategoryService";

/**
 * Handles fetching and managing category data.
 *
 * Owns the fetch lifecycle state including loading,
 * and manual refetching.
 *
 * @param {Object|null} selectedCluster - Selected cluster used
 * to filter categories.
 *
 * @returns {{
 *   categories: Array,
 *   isLoading: boolean,
 *   refetch: Function
 * }}
 */
export default function useCategories(selectedCluster) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadCategories() {
    if (!selectedCluster) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const response = await fetchCategories({
      cluster_id: selectedCluster.id,
    });

    setCategories(response.items);

    setIsLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, [selectedCluster]);

  return {
    categories,
    isLoading,
    refetch: loadCategories,
  };
}
