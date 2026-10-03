import { useQuery } from "@tanstack/react-query";

import { fetchBusinessUpdateRequest } from "../services/businessUpdateRequestService";
import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys";

/** Loads an individual name change request with current business context. */
export default function useBusinessUpdateRequestDetail(requestId) {
  const query = useQuery({
    queryKey: adminBusinessUpdateRequestKeys.detail(requestId),
    queryFn: () => fetchBusinessUpdateRequest(requestId),
    enabled: Boolean(requestId),
    refetchOnMount: "always",
  });

  return {
    request: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
