import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as reviewService from "../api/reviewBusiness.service";
import type { LocalReviewPhoto } from "../types/review.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export const businessReviewsKey = (businessId: number) =>
  ["business-reviews", businessId] as const;

function useReviewMutation<T>(
  businessId: number,
  mutationFn: (variables: T) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: T) =>
      throwOnApiError((await mutationFn(variables)) as any),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: businessReviewsKey(businessId),
      }),
  });
}

export function useBusinessReviews(businessId: number) {
  const query = useQuery({
    queryKey: businessReviewsKey(businessId),
    queryFn: async () =>
      throwOnApiError(await reviewService.getBusinessReviewPreview(businessId)),
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data?.reviews ?? [],
    totalCount: query.data?.total_count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Retrieves the complete collection for the dedicated reviews screen. */
export function useAllBusinessReviews(businessId: number) {
  const query = useQuery({
    queryKey: [...businessReviewsKey(businessId), "all"],
    queryFn: async () => throwOnApiError(await reviewService.getAllBusinessReviews(businessId)),
    enabled: Boolean(businessId),
  });
  return { reviews: query.data ?? [], totalCount: query.data?.length ?? 0, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

export function useCreateReview(businessId: number) {
  return useReviewMutation(
    businessId,
    ({ text, photos }: { text: string; photos: LocalReviewPhoto[] }) =>
      reviewService.createReview(businessId, text, photos) as ReturnType<
        typeof reviewService.deleteReview
      >,
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
    }) =>
      reviewService.updateReview(
        reviewId,
        text,
        photos,
        keepPhotoIds,
      ) as ReturnType<typeof reviewService.deleteReview>,
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
export function useReviewLike(businessId: number) {
  return useReviewMutation(
    businessId,
    ({ reviewId, isLiked }: { reviewId: number; isLiked: boolean }) =>
      isLiked
        ? reviewService.unlikeReview(reviewId)
        : reviewService.likeReview(reviewId),
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
    }) =>
      reviewService.reportReview(reviewId, reportType) as ReturnType<
        typeof reviewService.deleteReview
      >,
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
    }) =>
      reviewService.createReviewReply(reviewId, text, photos) as ReturnType<
        typeof reviewService.deleteReview
      >,
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
    }) =>
      reviewService.updateReviewReply(
        replyId,
        text,
        photos,
        keepPhotoIds,
      ) as ReturnType<typeof reviewService.deleteReview>,
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

export default useBusinessReviews;
