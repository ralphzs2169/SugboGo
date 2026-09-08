import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  dismissReviewDispute,
  upholdReviewDispute,
} from "../services/reviewDisputeService";

export default function useReviewDisputeMutations() {
  const queryClient = useQueryClient();

  async function invalidateReviewDisputeQueries(disputeId) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-dispute", String(disputeId)],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-disputes"],
      }),
    ]);
  }

  const upholdMutation = useMutation({
    mutationFn: ({ disputeId, data }) => upholdReviewDispute(disputeId, data),
    onSuccess: (_, { disputeId }) =>
      invalidateReviewDisputeQueries(disputeId),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ disputeId, data }) => dismissReviewDispute(disputeId, data),

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
