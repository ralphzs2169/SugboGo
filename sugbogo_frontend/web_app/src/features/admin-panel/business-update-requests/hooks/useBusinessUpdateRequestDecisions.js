import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveBusinessUpdateRequest,
  rejectBusinessUpdateRequest,
} from "../services/businessUpdateRequestService";
import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys";

/** Applies Admin decisions and refreshes only the affected request resources. */
export default function useBusinessUpdateRequestDecisions() {
  const queryClient = useQueryClient();

  async function refreshRequests(requestId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminBusinessUpdateRequestKeys.lists,
      }),
      queryClient.invalidateQueries({
        queryKey: adminBusinessUpdateRequestKeys.detail(requestId),
      }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: approveBusinessUpdateRequest,
    onSuccess: (_, requestId) => refreshRequests(requestId),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ requestId, rejectionReason }) =>
      rejectBusinessUpdateRequest(requestId, rejectionReason),
    onSuccess: (_, { requestId }) => refreshRequests(requestId),
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
