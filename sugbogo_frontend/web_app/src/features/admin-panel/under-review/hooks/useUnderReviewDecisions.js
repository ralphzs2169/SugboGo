import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveUnderReviewReview,
  rejectUnderReviewReview,
} from "../services/underReviewService";

export default function useUnderReviewDecisions() {
  const queryClient = useQueryClient();

  async function refreshReviews(reviewId) {
    queryClient.removeQueries({
      queryKey: ["admin", "under-review", "detail", reviewId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["admin", "under-review", "list"],
    });
  }

  const approveMutation = useMutation({
    mutationFn: approveUnderReviewReview,
    onSuccess: (_, reviewId) => refreshReviews(reviewId),
  });
  const rejectMutation = useMutation({
    mutationFn: rejectUnderReviewReview,
    onSuccess: (_, reviewId) => refreshReviews(reviewId),
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
