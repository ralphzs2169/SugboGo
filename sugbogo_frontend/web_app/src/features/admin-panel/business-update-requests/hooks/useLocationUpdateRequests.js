import { useQuery } from "@tanstack/react-query";

import { fetchLocationUpdateRequests } from "../services/locationUpdateRequestService";
import { adminLocationUpdateRequestKeys } from "./locationUpdateRequestQueryKeys";

/** Loads one independently paginated location request queue page. */
export default function useLocationUpdateRequests(filters, options = {}) {
  const query = useQuery({
    queryKey: adminLocationUpdateRequestKeys.list(filters),
    queryFn: () => fetchLocationUpdateRequests(filters),
    enabled: options.enabled ?? true,
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
