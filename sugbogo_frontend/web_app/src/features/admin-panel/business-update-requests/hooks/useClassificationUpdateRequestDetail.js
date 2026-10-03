import { useQuery } from "@tanstack/react-query";

import { fetchClassificationUpdateRequest } from "../services/classificationUpdateRequestService";
import { adminClassificationUpdateRequestKeys } from "./classificationUpdateRequestQueryKeys";

/** Loads one classification request with current and captured taxonomy context. */
export default function useClassificationUpdateRequestDetail(requestId) {
  const query = useQuery({
    queryKey: adminClassificationUpdateRequestKeys.detail(requestId),
    queryFn: () => fetchClassificationUpdateRequest(requestId),
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
