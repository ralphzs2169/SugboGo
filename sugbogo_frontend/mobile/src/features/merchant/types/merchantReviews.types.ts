import type { ReviewSentiment } from "@/features/explore/types/review.types";

export type MerchantReviewFilter = "all" | "needs-reply" | "replied";
export type MerchantReviewOrdering = "newest" | "oldest" | "most_liked";

export const MERCHANT_REVIEW_PAGE_SIZE = 10;

export type MerchantReviewLocation = {
  review_id: number;
  page: number;
  page_size: number;
};
export type MerchantReviewSelection = {
  filter: MerchantReviewFilter;
  ordering: MerchantReviewOrdering;
  contentFilters: MerchantReviewContentFilters;
};

export type MerchantReviewContentFilters = {
  sentiment: ReviewSentiment | null;
  topic: string | null;
  hasPhotos: boolean;
};

export const DEFAULT_MERCHANT_REVIEW_CONTENT_FILTERS: MerchantReviewContentFilters =
  {
    sentiment: null,
    topic: null,
    hasPhotos: false,
  };
