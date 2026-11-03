import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BUSINESS_CHANGED_EVENT } from "../queries/businessResourceEvents";
import {
  businessStatusKeys,
  businessStatusQueryOptions,
} from "../queries/businessStatusQuery";
import {
  fetchBusinessStatusHistory,
  fetchBusinessVisits,
} from "../services/businessService";

/** Keep optional analytics and paginated private history independent from the core detail read. */
export default function useBusinessDetailResources(businessId, enabled) {
  const client = useQueryClient();
  const status = useQuery({
    ...businessStatusQueryOptions(businessId),
    enabled,
  });
  const visits = useQuery({
    queryKey: [
      "admin",
      "analytics",
      "business-detail",
      String(businessId),
      "30",
    ],
    queryFn: ({ signal }) => fetchBusinessVisits(businessId, { signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const history = useInfiniteQuery({
    queryKey: businessStatusKeys.history(businessId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchBusinessStatusHistory(businessId, pageParam, { signal }),
    getNextPageParam: (last) =>
      last.pagination.has_next ? last.pagination.page + 1 : undefined,
    enabled,
    retry: false,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    function changed(event) {
      if (
        event.detail?.businessId != null &&
        String(event.detail.businessId) !== String(businessId)
      )
        return;
      void client.invalidateQueries({
        queryKey: businessStatusKeys.status(businessId),
      });
      void client.invalidateQueries({
        queryKey: businessStatusKeys.history(businessId),
      });
      void client.invalidateQueries({
        queryKey: ["admin", "analytics", "business-detail", String(businessId)],
      });
    }
    window.addEventListener(BUSINESS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(BUSINESS_CHANGED_EVENT, changed);
  }, [businessId, client, enabled]);
  return { status, visits, history };
}
