import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as reviewService from "../api/reviewBusiness.service";
import type {
  BusinessReviewFilters,
  BusinessReviewListResponse,
  BusinessReviewPreview,
  BusinessReview,
  LocalReviewPhoto,
} from "../types/review.types";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
  filteredBusinessReviewsKey,
} from "./reviewQueryKeys";

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
    userReview: query.data?.user_review ?? null,
    hasOwnReview: Boolean(query.data?.user_review),
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Loads filtered review pages in the backend's stable order. */
export function useBusinessReviews(
  businessId: number,
  filters?: BusinessReviewFilters,
) {
  const query = useInfiniteQuery({
    queryKey: filters
      ? filteredBusinessReviewsKey(businessId, filters)
      : businessReviewsKey(businessId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<BusinessReviewListResponse> =>
      throwOnApiError(
        await reviewService.getAllBusinessReviews(
          businessId,
          filters,
          pageParam,
        ),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next
        ? lastPage.pagination.page + 1
        : undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: query.data?.pages[0]?.pagination.total_items ?? 0,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    isPlaceholderData: query.isPlaceholderData,

    isInitialLoading: query.isLoading && !query.isFetched,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,

    error: query.error,
    refetch: query.refetch,
  };
}

/** Keeps merchant review management's existing complete collection available. */
export function useMerchantBusinessReviews(businessId: number) {
  const query = useQuery({
    queryKey: [...businessReviewsKey(businessId), "merchant-all"],
    queryFn: async (): Promise<{
      reviews: BusinessReview[];
      totalCount: number;
    }> => {
      const reviews: BusinessReview[] = [];
      let page = 1;
      let hasNext = true;
      let totalCount = 0;

      while (hasNext) {
        const result = throwOnApiError(
          await reviewService.getAllBusinessReviews(
            businessId,
            undefined,
            page,
            100,
          ),
        );

        reviews.push(...result.items);
        totalCount = result.pagination.total_items;
        hasNext = result.pagination.has_next;
        page += 1;
      }

      return { reviews, totalCount };
    },
    enabled: Boolean(businessId),
  });

  return {
    reviews: query.data?.reviews ?? [],
    totalCount: query.data?.totalCount ?? 0,
    isInitialLoading: query.isLoading && !query.isFetched,
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
