import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";

import {
  dismissReviewDispute,
  upholdReviewDispute,
} from "../services/reviewDisputeService";

export default function useReviewDisputeMutations() {
  const queryClient = useQueryClient();

  async function invalidateReviewDisputeQueries(disputeId) {
    await Promise.all([
      invalidateDashboardDecision(queryClient),
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-dispute", String(disputeId)],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-disputes"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "moderation-counts"],
      }),
    ]);
  }

  const upholdMutation = useMutation({
    mutationFn: ({ disputeId, data }) => upholdReviewDispute(disputeId, data),
    retry: false,
    onSuccess: (_, { disputeId }) =>
      invalidateReviewDisputeQueries(disputeId),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ disputeId, data }) => dismissReviewDispute(disputeId, data),
    retry: false,

    onSuccess: (_, { disputeId }) =>
      invalidateReviewDisputeQueries(disputeId),
  });

  return {
    uphold: upholdMutation.mutateAsync,
    dismiss: dismissMutation.mutateAsync,

    isUpholding: upholdMutation.isPending,
    isDismissing: dismissMutation.isPending,

    upholdError: upholdMutation.error,
    dismissError: dismissMutation.error,
  };
}
