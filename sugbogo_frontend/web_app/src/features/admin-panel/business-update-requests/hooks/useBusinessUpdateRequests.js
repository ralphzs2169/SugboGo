import { useQuery } from "@tanstack/react-query";

import { fetchBusinessUpdateRequests } from "../services/businessUpdateRequestService";
import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys";

/** Loads one server-paginated, status-filtered Admin request queue page. */
export default function useBusinessUpdateRequests(filters) {
  const query = useQuery({
    queryKey: adminBusinessUpdateRequestKeys.list(filters),
    queryFn: () => fetchBusinessUpdateRequests(filters),
  });

  return {
    requests: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    hasData: Boolean(query.data),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
