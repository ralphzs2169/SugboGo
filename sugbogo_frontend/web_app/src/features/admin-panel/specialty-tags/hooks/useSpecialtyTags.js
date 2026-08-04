import { useEffect, useState } from "react";
import { fetchSpecialtyTags } from "../services/specialtyTagService";

export default function useSpecialtyTags(params = {}, { enabled = true } = {}) {
  const [specialtyTags, setSpecialtyTags] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  async function loadSpecialtyTags() {
    const initialLoad = specialtyTags.length === 0;

    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    setError(null);

    try {
      const response = await fetchSpecialtyTags(params);

      setSpecialtyTags(response.items ?? []);
      setTotalItems(response.pagination?.total_items ?? 0);
      setPageCount(response.pagination?.total_pages ?? 0);
    } catch (error) {
      console.error("Failed to load specialty tags:", error);

      setError(error);
      setSpecialtyTags([]);
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

    loadSpecialtyTags();
  }, [enabled, params.search, params.page, params.page_size, params.ordering]);

  return {
    specialtyTags,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch: loadSpecialtyTags,
  };
}
