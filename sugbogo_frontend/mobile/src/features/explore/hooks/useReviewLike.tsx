import {
  type InfiniteData,
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import type {
  CommunityReview,
  CommunityReviewListResponse,
} from "@/features/community/types/communityReview.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as reviewService from "../api/reviewBusiness.service";
import type {
  BusinessReview,
  BusinessReviewListResponse,
  BusinessReviewPreview,
} from "../types/review.types";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "./reviewQueryKeys";

type LikeVariables = {
  reviewId: number;
  isLiked: boolean;
  isOwner?: boolean;
};

type HelpfulReview = {
  id: number;
  is_liked: boolean;
  like_count: number;
  is_liked_by_owner: boolean;
};

type CachedReviewCollection =
  | InfiniteData<BusinessReviewListResponse, number>
  | { reviews: BusinessReview[]; totalCount: number };
type CommunityCollection = InfiniteData<CommunityReviewListResponse, number>;

function updateHelpful<T extends HelpfulReview>(
  review: T,
  reviewId: number,
  liked: boolean,
  isOwner?: boolean,
): T {
  if (review.id !== reviewId) return review;
  if (
    review.is_liked === liked &&
    (isOwner === undefined || review.is_liked_by_owner === liked)
  ) {
    return review;
  }

  return {
    ...review,
    is_liked: liked,
    like_count: Math.max(
      0,
      review.like_count + (review.is_liked === liked ? 0 : liked ? 1 : -1),
    ),
    is_liked_by_owner: isOwner === undefined ? review.is_liked_by_owner : liked,
  };
}

function restoreHelpful<T extends HelpfulReview>(
  review: T,
  reviewId: number,
  previous: T | undefined,
): T {
  if (review.id !== reviewId || !previous) return review;
  return {
    ...review,
    is_liked: previous.is_liked,
    like_count: previous.like_count,
    is_liked_by_owner: previous.is_liked_by_owner,
  };
}

function findInBusinessCollection(
  collection: CachedReviewCollection | undefined,
  reviewId: number,
) {
  if (!collection) return undefined;
  return "pages" in collection
    ? collection.pages
        .flatMap((page) => page.items)
        .find((review) => review.id === reviewId)
    : collection.reviews.find((review) => review.id === reviewId);
}

function findInCommunityCollection(
  collection: CommunityCollection | undefined,
  reviewId: number,
) {
  return collection?.pages
    .flatMap((page) => page.items)
    .find((review) => review.id === reviewId);
}

/**
 * Synchronizes helpful state across business and Community review caches.
 *
 * Per-review mutations run sequentially. Community pages stay in their
 * original order until an explicit refresh or a later fresh query load.
 */
export function useReviewLike(businessId: number, reviewIdForScope?: number) {
  const queryClient = useQueryClient();
  const mutationKey = [
    "review-like",
    reviewIdForScope ?? `business-${businessId}`,
  ] as const;
  const pendingForReview = useIsMutating({ mutationKey });
  const requestPlan = useRef(new WeakMap<LikeVariables, boolean>());

  function patchCaches(reviewId: number, liked: boolean, isOwner?: boolean) {
    const patch = <T extends HelpfulReview>(review: T) =>
      updateHelpful(review, reviewId, liked, isOwner);

    queryClient.setQueryData<BusinessReviewPreview>(
      businessReviewPreviewKey(businessId),
      (old) => {
        if (
          !old ||
          (!old.reviews.some((review) => review.id === reviewId) &&
            old.user_review?.id !== reviewId)
        ) {
          return old;
        }
        return {
          ...old,
          reviews: old.reviews.map(patch),
          user_review: old.user_review ? patch(old.user_review) : null,
        };
      },
    );
    queryClient.setQueriesData<CachedReviewCollection>(
      { queryKey: businessReviewsKey(businessId) },
      (old) => {
        if (!old || !findInBusinessCollection(old, reviewId)) return old;
        return "pages" in old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(patch),
              })),
            }
          : { ...old, reviews: old.reviews.map(patch) };
      },
    );
    queryClient.setQueriesData<CommunityCollection>(
      { queryKey: COMMUNITY_REVIEWS_QUERY_KEY },
      (old) => {
        if (!old || !findInCommunityCollection(old, reviewId)) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map(patch),
          })),
        };
      },
    );
  }

  const mutation = useMutation({
    mutationKey,
    scope: {
      id: `review-like-${reviewIdForScope ?? `business-${businessId}`}`,
    },
    mutationFn: async (variables: LikeVariables) => {
      if (requestPlan.current.get(variables) === false) return null;
      return throwOnApiError(
        variables.isLiked
          ? await reviewService.unlikeReview(variables.reviewId)
          : await reviewService.likeReview(variables.reviewId),
      );
    },

    onMutate: async (variables: LikeVariables) => {
      const { reviewId, isLiked, isOwner } = variables;
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.cancelQueries({ queryKey: businessReviewsKey(businessId) }),
        queryClient.cancelQueries({
          queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
          predicate: (query) =>
            Boolean(
              findInCommunityCollection(
                query.state.data as CommunityCollection | undefined,
                reviewId,
              ),
            ),
        }),
      ]);

      const previousPreview = queryClient.getQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
      );
      const previousLists = queryClient.getQueriesData<CachedReviewCollection>({
        queryKey: businessReviewsKey(businessId),
      });
      const previousCommunity = queryClient.getQueriesData<CommunityCollection>(
        {
          queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
        },
      );
      const cachedReviews = [
        previousPreview?.reviews.find((review) => review.id === reviewId),
        previousPreview?.user_review?.id === reviewId
          ? previousPreview.user_review
          : undefined,
        ...previousLists.map(([, collection]) =>
          findInBusinessCollection(collection, reviewId),
        ),
        ...previousCommunity.map(([, collection]) =>
          findInCommunityCollection(collection, reviewId),
        ),
      ].filter((review) => review !== undefined);
      const nextLiked = !isLiked;
      const shouldRequest =
        cachedReviews.length === 0 ||
        cachedReviews.some((review) => review.is_liked !== nextLiked);
      requestPlan.current.set(variables, shouldRequest);
      patchCaches(reviewId, nextLiked, isOwner);

      return {
        previousPreview,
        previousLists,
        previousCommunity,
        shouldRequest,
      };
    },

    onSuccess: (response, { reviewId, isOwner }) => {
      if (response) patchCaches(reviewId, response.is_liked, isOwner);
    },

    onError: (_error, { reviewId }, context) => {
      if (!context) return;
      const previousPreview = context.previousPreview;
      queryClient.setQueryData<BusinessReviewPreview>(
        businessReviewPreviewKey(businessId),
        (old) =>
          old &&
          previousPreview && {
            ...old,
            reviews: old.reviews.map((review) =>
              restoreHelpful(
                review,
                reviewId,
                previousPreview.reviews.find((item) => item.id === reviewId),
              ),
            ),
            user_review: old.user_review
              ? restoreHelpful(
                  old.user_review,
                  reviewId,
                  previousPreview.user_review ?? undefined,
                )
              : null,
          },
      );
      for (const [queryKey, previous] of context.previousLists) {
        queryClient.setQueryData<CachedReviewCollection>(queryKey, (old) => {
          if (!old || !previous) return old;
          const restore = (review: BusinessReview) =>
            restoreHelpful(
              review,
              reviewId,
              findInBusinessCollection(previous, reviewId),
            );
          return "pages" in old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map(restore),
                })),
              }
            : { ...old, reviews: old.reviews.map(restore) };
        });
      }
      for (const [queryKey, previous] of context.previousCommunity) {
        queryClient.setQueryData<CommunityCollection>(
          queryKey,
          (old) =>
            old &&
            previous && {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((review: CommunityReview) =>
                  restoreHelpful(
                    review,
                    reviewId,
                    findInCommunityCollection(previous, reviewId),
                  ),
                ),
              })),
            },
        );
      }
    },

    onSettled: async (_response, _error, _variables, context) => {
      if (!context?.shouldRequest) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: businessReviewPreviewKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: businessReviewsKey(businessId),
        }),
        queryClient.invalidateQueries({
          queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
          refetchType: "none",
        }),
      ]);
    },
  });

  return {
    ...mutation,
    isPending: mutation.isPending || pendingForReview > 0,
  };
}
