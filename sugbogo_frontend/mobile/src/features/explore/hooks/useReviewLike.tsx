import { useMutation, useQueryClient } from "@tanstack/react-query";

import * as reviewService from "../api/reviewBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "./useBusinessReviews";

import type {
  BusinessReview,
  BusinessReviewPreview,
} from "../types/review.types";

/**
 * Likes or unlikes a review optimistically so the UI responds immediately.
 * The previous cache is restored if the request fails, then server data
 * is revalidated to guarantee consistency.
 */
export function useReviewLike(businessId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reviewId,
      isLiked,
    }: {
      reviewId: number;
      isLiked: boolean;
    }) =>
      throwOnApiError(
        isLiked
          ? await reviewService.unlikeReview(reviewId)
          : await reviewService.likeReview(reviewId),
      ),

    onMutate: async ({ reviewId, isLiked }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.cancelQueries({
          queryKey: businessReviewsKey(businessId),
        }),
      ]);

      const previousPreview = queryClient.getQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
      );

      const previousList = queryClient.getQueryData<BusinessReview[]>(
        businessReviewsKey(businessId),
      );

      const toggleReview = (review: BusinessReview): BusinessReview =>
        review.id === reviewId
          ? {
              ...review,
              is_liked: !isLiked,
              like_count: review.like_count + (isLiked ? -1 : 1),
            }
          : review;

      queryClient.setQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
        (old) =>
          old
            ? {
                ...old,
                reviews: old.reviews.map(toggleReview),
              }
            : old,
      );

      queryClient.setQueryData<BusinessReview[]>(
        businessReviewsKey(businessId),
        (old) => (old ? old.map(toggleReview) : old),
      );

      return {
        previousPreview,
        previousList,
      };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousPreview) {
        queryClient.setQueryData(
          businessReviewPreviewKey(businessId),
          context.previousPreview,
        );
      }

      if (context?.previousList) {
        queryClient.setQueryData(
          businessReviewsKey(businessId),
          context.previousList,
        );
      }
    },

    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
      ]);
    },
  });
}
