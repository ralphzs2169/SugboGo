import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAllBusinessReviews } from "@/features/explore/api/reviewBusiness.service";
import { DEFAULT_BUSINESS_REVIEW_FILTERS } from "@/features/explore/types/review.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import type {
  MerchantReviewFilter,
  MerchantReviewOrdering,
} from "../../types/merchantReviews.types";
import { merchantReviewFeedKey } from "./merchantReviewQueryKeys";

/** Loads only the requested server-filtered page; filter changes never relabel old content. */
export default function useMerchantReviewFeed(
  businessId: number,
  filter: MerchantReviewFilter,
  ordering: MerchantReviewOrdering,
  enabled = true,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const query = useInfiniteQuery({
    queryKey: merchantReviewFeedKey(accountId, businessId, filter, ordering),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(
        await getAllBusinessReviews(
          businessId,
          {
            ...DEFAULT_BUSINESS_REVIEW_FILTERS,
            needsReply: filter === "needs-reply",
            merchantReplied: filter === "replied",
            ordering,
          },
          pageParam,
        ),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
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
