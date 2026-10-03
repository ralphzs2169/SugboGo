import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveClassificationUpdateRequest,
  rejectClassificationUpdateRequest,
} from "../services/classificationUpdateRequestService";
import { adminClassificationUpdateRequestKeys } from "./classificationUpdateRequestQueryKeys";

/** Records classification decisions and refreshes its independent queue and detail caches. */
export default function useClassificationUpdateRequestDecisions() {
  const queryClient = useQueryClient();

  async function refreshRequests(requestId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminClassificationUpdateRequestKeys.lists,
      }),
      queryClient.invalidateQueries({
        queryKey: adminClassificationUpdateRequestKeys.detail(requestId),
      }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: approveClassificationUpdateRequest,
    onSuccess: (_, requestId) => refreshRequests(requestId),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ requestId, rejectionReason }) =>
      rejectClassificationUpdateRequest(requestId, rejectionReason),
    onSuccess: (_, { requestId }) => refreshRequests(requestId),
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
