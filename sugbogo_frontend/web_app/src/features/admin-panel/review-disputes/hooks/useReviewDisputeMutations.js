import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  dismissReviewDispute,
  startReviewDispute,
  upholdReviewDispute,
} from "../services/reviewDisputeService";

export default function useReviewDisputeMutations() {
  const queryClient = useQueryClient();

  const startReviewMutation = useMutation({
    mutationFn: startReviewDispute,

    onSuccess: (_, disputeId) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-dispute", disputeId],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin", "review-disputes"],
      });
    },
  });

  const upholdMutation = useMutation({
    mutationFn: ({ disputeId, data }) => upholdReviewDispute(disputeId, data),

    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-dispute", disputeId],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin", "review-disputes"],
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ disputeId, data }) => dismissReviewDispute(disputeId, data),

    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "review-dispute", disputeId],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin", "review-disputes"],
      });
    },
  });

  return {
    startReview: startReviewMutation.mutateAsync,
    uphold: upholdMutation.mutateAsync,
    dismiss: dismissMutation.mutateAsync,

    isStartingReview: startReviewMutation.isPending,
    isUpholding: upholdMutation.isPending,
    isDismissing: dismissMutation.isPending,

    startReviewError: startReviewMutation.error,
    upholdError: upholdMutation.error,
    dismissError: dismissMutation.error,
  };
}
