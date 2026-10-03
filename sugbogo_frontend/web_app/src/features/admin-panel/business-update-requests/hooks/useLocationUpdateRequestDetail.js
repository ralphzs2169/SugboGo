import { useQuery } from "@tanstack/react-query";

import { fetchLocationUpdateRequest } from "../services/locationUpdateRequestService";
import { adminLocationUpdateRequestKeys } from "./locationUpdateRequestQueryKeys";

/** Loads frozen and current location snapshots for one Admin review. */
export default function useLocationUpdateRequestDetail(requestId) {
  const query = useQuery({
    queryKey: adminLocationUpdateRequestKeys.detail(requestId),
    queryFn: () => fetchLocationUpdateRequest(requestId),
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
