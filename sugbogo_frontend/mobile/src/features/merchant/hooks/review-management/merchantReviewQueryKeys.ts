import { businessReviewsKey } from "@/features/explore/hooks/reviewQueryKeys";
import type {
  MerchantReviewContentFilters,
  MerchantReviewFilter,
  MerchantReviewOrdering,
} from "../../types/merchantReviews.types";
import { DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS } from "../../types/merchantReviews.types";

/** Retains business-review mutation invalidation while isolating accounts and list criteria. */
export function merchantReviewFeedKey(
  accountId: number | undefined,
  businessId: number,
  filter: MerchantReviewFilter,
  ordering: MerchantReviewOrdering,
  contentFilters: MerchantReviewContentFilters = DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS,
) {
  return [
    ...businessReviewsKey(businessId),
    "merchant-feed",
    accountId,
    { filter, ordering, ...contentFilters },
  ] as const;
}

/** Keeps notification lookup stable while review mutations refresh the visible feed. */
export function merchantReviewFocusKey(
  accountId: number | undefined,
  businessId: number,
  reviewId: number | null,
  entry: number,
) {
  return [
    "merchant-review-focus",
    accountId,
    businessId,
    reviewId,
    entry,
  ] as const;
}
