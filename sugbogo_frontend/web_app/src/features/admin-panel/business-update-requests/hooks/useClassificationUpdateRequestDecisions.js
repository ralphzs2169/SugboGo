import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessOverviewQueryKey } from "../../businesses/queries/businessOverviewQuery";
import { updateRequestSummaryKey } from "../services/updateRequestMetricsService";

import {
  approveClassificationUpdateRequest,
  rejectClassificationUpdateRequest,
} from "../services/classificationUpdateRequestService";
import { adminClassificationUpdateRequestKeys } from "./classificationUpdateRequestQueryKeys";
import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { notifyBusinessChanged } from "../../businesses/queries/businessResourceEvents";

/** Records classification decisions and refreshes its independent queue and detail caches. */
export default function useClassificationUpdateRequestDecisions() {
  const queryClient = useQueryClient();

  async function refreshRequests(requestId) {
    notifyBusinessChanged(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: updateRequestSummaryKey }),
      invalidateDashboardDecision(queryClient),
      queryClient.invalidateQueries({
        queryKey: businessOverviewQueryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: adminClassificationUpdateRequestKeys.lists,
      }),
      queryClient.invalidateQueries({
        queryKey: adminBusinessUpdateRequestKeys.combinedLists,
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
