import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";

import {
  approveUnderReviewReview,
  rejectUnderReviewReview,
} from "../services/underReviewService";

export default function useUnderReviewDecisions() {
  const queryClient = useQueryClient();

  async function refreshReviews(reviewId, { publication = false } = {}) {
    queryClient.removeQueries({
      queryKey: ["admin", "under-review", "detail", reviewId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["admin", "under-review", "list"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["admin", "moderation-counts"],
    });
    await invalidateDashboardDecision(queryClient, { publication });
  }

  const approveMutation = useMutation({
    mutationFn: approveUnderReviewReview,
    onSuccess: (_, reviewId) => refreshReviews(reviewId, { publication: true }),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ reviewId, moderationNotes }) =>
      rejectUnderReviewReview(reviewId, moderationNotes),
    onSuccess: (_, { reviewId }) => refreshReviews(reviewId),
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
