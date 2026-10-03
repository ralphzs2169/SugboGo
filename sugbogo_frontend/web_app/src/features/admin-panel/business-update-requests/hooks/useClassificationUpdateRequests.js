import { useQuery } from "@tanstack/react-query";

import { fetchClassificationUpdateRequests } from "../services/classificationUpdateRequestService";
import { adminClassificationUpdateRequestKeys } from "./classificationUpdateRequestQueryKeys";

/** Loads one independently paginated classification request queue page. */
export default function useClassificationUpdateRequests(filters, options = {}) {
  const query = useQuery({
    queryKey: adminClassificationUpdateRequestKeys.list(filters),
    queryFn: () => fetchClassificationUpdateRequests(filters),
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
