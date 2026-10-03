import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveLocationUpdateRequest,
  rejectLocationUpdateRequest,
} from "../services/locationUpdateRequestService";
import { adminLocationUpdateRequestKeys } from "./locationUpdateRequestQueryKeys";

/** Records a location decision and refreshes only its queue and detail resources. */
export default function useLocationUpdateRequestDecisions() {
  const queryClient = useQueryClient();

  async function refreshRequests(requestId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminLocationUpdateRequestKeys.lists,
      }),
      queryClient.invalidateQueries({
        queryKey: adminLocationUpdateRequestKeys.detail(requestId),
      }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: approveLocationUpdateRequest,
    onSuccess: (_, requestId) => refreshRequests(requestId),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ requestId, rejectionReason }) =>
      rejectLocationUpdateRequest(requestId, rejectionReason),
    onSuccess: (_, { requestId }) => refreshRequests(requestId),
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
