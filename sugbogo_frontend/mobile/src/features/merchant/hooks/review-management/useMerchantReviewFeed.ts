import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAllBusinessReviews } from "@/features/explore/api/reviewBusiness.service";
import { DEFAULT_BUSINESS_REVIEW_FILTERS } from "@/features/explore/types/review.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantReviewFeedKey } from "./merchantReviewQueryKeys";
import {
  MERCHANT_REVIEW_PAGE_SIZE,
  DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
  type MerchantReviewContentFilters,
  type MerchantReviewFilter,
  type MerchantReviewOrdering,
  type MerchantReviewLocation,
} from "../../types/merchantReviews.types";

/** Loads only the requested server-filtered page; filter changes never relabel old content. */
export default function useMerchantReviewFeed(
  businessId: number,
  filter: MerchantReviewFilter,
  ordering: MerchantReviewOrdering,
  enabled = true,
  location?: MerchantReviewLocation,
  contentFilters: MerchantReviewContentFilters = DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: location
      ? [
          ...merchantReviewFeedKey(
            accountId,
            businessId,
            filter,
            ordering,
            contentFilters,
          ),
          { reviewId: location.review_id, page: location.page },
        ]
      : merchantReviewFeedKey(
          accountId,
          businessId,
          filter,
          ordering,
          contentFilters,
        ),
    initialPageParam: location?.page ?? 1,
    queryFn: async ({ pageParam }) => {
      const filters = {
        ...DEFAULT_BUSINESS_REVIEW_FILTERS,
        ...contentFilters,
        needsReply: filter === "needs-reply",
        merchantReplied: filter === "replied",
        ordering,
      };
      const response = location
        ? await getAllBusinessReviews(
            businessId,
            filters,
            pageParam,
            MERCHANT_REVIEW_PAGE_SIZE,
          )
        : await getAllBusinessReviews(businessId, filters, pageParam);
      return throwOnApiError(response);
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.pagination.has_previous
        ? firstPage.pagination.page - 1
        : undefined,
    enabled: !!accountId && !!businessId && enabled,
    retry: false,
    staleTime: 60_000,
  });
  return {
    ...query,
    reviews: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: query.data?.pages[0]?.pagination.total_items,
    isInitialLoading: query.isLoading,
  };
}
