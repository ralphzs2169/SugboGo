import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as reviewService from "../api/reviewBusiness.service";
import type {
  BusinessReview,
  BusinessReviewPreview,
  LocalReviewPhoto,
} from "../types/review.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export const businessReviewPreviewKey = (businessId: number) =>
  ["business-review-preview", businessId] as const;

export const businessReviewsKey = (businessId: number) =>
  ["business-reviews", businessId] as const;

export const exploreBusinessDetailKey = (businessId: number) =>
  ["explore-business-detail", businessId] as const;

/**
 * Handles review-related mutations and refreshes the affected
 * review and business-detail queries after a successful mutation.
 */
function useReviewMutation<T>(
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

/** Retrieves the review preview shown on the business profile. */
export function useBusinessReviewPreview(businessId: number) {
  const query = useQuery({
    queryKey: businessReviewPreviewKey(businessId),
    queryFn: async (): Promise<BusinessReviewPreview> =>
      throwOnApiError(await reviewService.getBusinessReviewPreview(businessId)),
    enabled: Boolean(businessId),
  });

  const reviews = query.data?.reviews ?? [];

  return {
    reviews,
    totalCount: query.error ? null : (query.data?.total_count ?? 0),
    hasOwnReview: reviews.some((review) => review.is_own_review),
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Retrieves the complete collection for the dedicated reviews screen. */
export function useBusinessReviews(businessId: number) {
  const query = useQuery({
    queryKey: businessReviewsKey(businessId),
    queryFn: async (): Promise<BusinessReview[]> =>
      throwOnApiError(await reviewService.getAllBusinessReviews(businessId)),
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data ?? [],
    totalCount: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateReview(businessId: number) {
  return useReviewMutation(
    businessId,
    ({ text, photos }: { text: string; photos: LocalReviewPhoto[] }) =>
      reviewService.createReview(businessId, text, photos),
  );
}

export function useUpdateReview(businessId: number) {
  return useReviewMutation(
    businessId,
    ({
      reviewId,
      text,
      photos,
      keepPhotoIds,
    }: {
      reviewId: number;
      text: string;
      photos: LocalReviewPhoto[];
      keepPhotoIds: number[];
    }) => reviewService.updateReview(reviewId, text, photos, keepPhotoIds),
  );
}

export function useDeleteReview(businessId: number) {
  return useReviewMutation(businessId, ({ reviewId }: { reviewId: number }) =>
    reviewService.deleteReview(reviewId),
  );
}

export function useDeleteReviewPhoto(businessId: number) {
  return useReviewMutation(businessId, ({ photoId }: { photoId: number }) =>
    reviewService.deleteReviewPhoto(photoId),
  );
}

export function useReportReview(businessId: number) {
  return useReviewMutation(
    businessId,
    ({
      reviewId,
      reportType,
    }: {
      reviewId: number;
      reportType: "spam" | "abuse" | "misinformation" | "other";
    }) => reviewService.reportReview(reviewId, reportType),
  );
}

export function useCreateReviewReply(businessId: number) {
  return useReviewMutation(
    businessId,
    ({
      reviewId,
      text,
      photos,
    }: {
      reviewId: number;
      text: string;
      photos: LocalReviewPhoto[];
    }) => reviewService.createReviewReply(reviewId, text, photos),
  );
}

export function useUpdateReviewReply(businessId: number) {
  return useReviewMutation(
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
    }) => reviewService.updateReviewReply(replyId, text, photos, keepPhotoIds),
  );
}

export function useDeleteReviewReply(businessId: number) {
  return useReviewMutation(businessId, ({ replyId }: { replyId: number }) =>
    reviewService.deleteReviewReply(replyId),
  );
}

export function useDeleteReplyPhoto(businessId: number) {
  return useReviewMutation(businessId, ({ photoId }: { photoId: number }) =>
    reviewService.deleteReplyPhoto(photoId),
  );
}
