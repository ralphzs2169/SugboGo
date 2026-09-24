import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import * as reviewService from "../api/reviewBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "./reviewQueryKeys";

import type {
  BusinessReview,
  BusinessReviewListResponse,
  BusinessReviewPreview,
} from "../types/review.types";

type CachedReviewCollection =
  | InfiniteData<BusinessReviewListResponse, number>
  | { reviews: BusinessReview[]; totalCount: number };

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
      isOwner?: boolean;
    }) =>
      throwOnApiError(
        isLiked
          ? await reviewService.unlikeReview(reviewId)
          : await reviewService.likeReview(reviewId),
      ),

    onMutate: async ({ reviewId, isLiked, isOwner }) => {
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

      const previousLists = queryClient.getQueriesData<CachedReviewCollection>({
        queryKey: businessReviewsKey(businessId),
      });

      const toggleReview = (review: BusinessReview): BusinessReview =>
        review.id === reviewId
          ? {
              ...review,
              is_liked: !isLiked,
              like_count: review.like_count + (isLiked ? -1 : 1),
              is_liked_by_owner: isOwner ? !isLiked : review.is_liked_by_owner,
            }
          : review;

      queryClient.setQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
        (old) =>
          old
            ? {
                ...old,
                reviews: old.reviews.map(toggleReview),
                user_review: old.user_review
                  ? toggleReview(old.user_review)
                  : null,
              }
            : old,
      );

      queryClient.setQueriesData<CachedReviewCollection>(
        { queryKey: businessReviewsKey(businessId) },
        (old) => {
          if (!old) {
            return old;
          }

          if ("pages" in old) {
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(toggleReview),
              })),
            };
          }

          return {
            ...old,
            reviews: old.reviews.map(toggleReview),
          };
        },
      );

      return {
        previousPreview,
        previousLists,
      };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousPreview) {
        queryClient.setQueryData(
          businessReviewPreviewKey(businessId),
          context.previousPreview,
        );
      }

      context?.previousLists.forEach(([queryKey, reviews]) => {
        queryClient.setQueryData(queryKey, reviews);
      });
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
