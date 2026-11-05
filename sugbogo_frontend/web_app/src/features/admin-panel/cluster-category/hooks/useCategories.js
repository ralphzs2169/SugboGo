import { useQuery } from "@tanstack/react-query";
import { taxonomyListOptions } from "../../taxonomy/queries/taxonomyQueries";

/** Expose cached taxonomy pages through the existing directory interface. */
export default function useCategories(params = {}, { enabled = true } = {}) {
  const query = useQuery({
    ...taxonomyListOptions("categories", params),
    enabled,
  });

  return {
    categories: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
