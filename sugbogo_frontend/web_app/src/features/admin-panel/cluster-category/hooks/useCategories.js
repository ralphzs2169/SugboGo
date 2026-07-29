import { useEffect, useState } from "react";
import { fetchCategories } from "../services/clusterCategoryService";

/**
 * Handles fetching and managing category data.
 *
 * Supports server-side:
 * - Search
 * - Sorting
 * - Pagination
 *
 * @param {Object} params - Query parameters passed to the API.
 *
 * @returns {{
 *   categories: Array,
 *   totalItems: number,
 *   pageCount: number,
 *   isLoading: boolean,
 *   error: Error | null,
 *   refetch: Function
 * }}
 */
export default function useCategories(params = {}) {
  const [categories, setCategories] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadCategories() {
    setIsLoading(true);
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
    }
  }

  useEffect(() => {
    loadCategories();
  }, [params.search, params.page, params.page_size, params.ordering]);

  return {
    categories,
    totalItems,
    pageCount,
    isLoading,
    error,
    refetch: loadCategories,
  };
}
