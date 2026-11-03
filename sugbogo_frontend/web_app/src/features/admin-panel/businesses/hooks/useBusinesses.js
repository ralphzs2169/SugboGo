import { useQuery } from "@tanstack/react-query";
import { businessListQueryOptions } from "../queries/businessListQuery";

/** Expose the existing directory interface through cancellable parameter-keyed queries. */
export default function useBusinesses(params = {}, { enabled = true } = {}) {
  const query = useQuery({
    ...businessListQueryOptions(params),
    enabled,
  });

  return {
    businesses: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
