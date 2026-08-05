import { useEffect, useState } from "react";
import { fetchCategories } from "../services/clusterCategoryService";

/**
 * Handles fetching and managing category data.
 *
 * Supports server-side:
 * - Search
 * - Sorting
 * - Pagination
 */
export default function useCategories(params = {}, { enabled = true } = {}) {
  const [categories, setCategories] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  async function loadCategories() {
    const initialLoad = categories.length === 0;

    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const response = await fetchCategories(params);

      setCategories(response.items ?? []);
      setTotalItems(response.pagination?.total_items ?? 0);
      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (error) {
      console.error("Failed to load categories:", error);

      setError(error);
      setCategories([]);
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

    loadCategories();
  }, [
    enabled,
    params.search,
    params.page,
    params.page_size,
    params.ordering,
    params.cluster_id,
  ]);

  return {
    categories,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadCategories,
  };
}
