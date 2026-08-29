import { useMutation, useQueryClient } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as reviewReplyService from "../../api/reviewReply.service";
import type { LocalReviewPhoto } from "../../types/review-reply/reviewReply.types";

import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "@/features/explore/hooks/reviewQueryKeys";

/**
 * Handles merchant review-reply mutations and refreshes the
 * affected review data after a successful mutation.
 */
function useReviewReplyMutation<T>(
  businessId: number,
  mutationFn: (variables: T) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: T) =>
      throwOnApiError((await mutationFn(variables)) as never),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: exploreBusinessDetailKey(businessId),
        }),
      ]);
    },
  });
}

export function useCreateReviewReply(businessId: number) {
  return useReviewReplyMutation(
    businessId,
    ({
      reviewId,
      text,
      photos,
    }: {
      reviewId: number;
      text: string;
      photos: LocalReviewPhoto[];
    }) => reviewReplyService.createReviewReply(reviewId, text, photos),
  );
}

export function useUpdateReviewReply(businessId: number) {
  return useReviewReplyMutation(
    businessId,
    ({
      replyId,
      text,
      photos,
      keepPhotoIds,
    }: {
      replyId: number;
      text: string;
      photos: LocalReviewPhoto[];
      keepPhotoIds: number[];
    }) =>
      reviewReplyService.updateReviewReply(replyId, text, photos, keepPhotoIds),
  );
}

export function useDeleteReviewReply(businessId: number) {
  return useReviewReplyMutation(
    businessId,
    ({ replyId }: { replyId: number }) =>
      reviewReplyService.deleteReviewReply(replyId),
  );
}

export function useDeleteReplyPhoto(businessId: number) {
  return useReviewReplyMutation(
    businessId,
    ({ photoId }: { photoId: number }) =>
      reviewReplyService.deleteReplyPhoto(photoId),
  );
}
