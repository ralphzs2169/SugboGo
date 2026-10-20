import { businessReviewsKey } from "@/features/explore/hooks/reviewQueryKeys";
import type {
  MerchantReviewFilter,
  MerchantReviewOrdering,
} from "../../types/merchantReviews.types";

/** Retains business-review mutation invalidation while isolating accounts and list criteria. */
export function merchantReviewFeedKey(
  accountId: number | undefined,
  businessId: number,
  filter: MerchantReviewFilter,
  ordering: MerchantReviewOrdering,
) {
  return [
    ...businessReviewsKey(businessId),
    "merchant-feed",
    accountId,
    { filter, ordering },
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
