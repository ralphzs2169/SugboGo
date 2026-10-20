export type MerchantReviewFilter = "all" | "needs-reply" | "replied";
export type MerchantReviewOrdering = "newest" | "oldest";

export const MERCHANT_REVIEW_PAGE_SIZE = 10;

export type MerchantReviewLocation = {
  review_id: number;
  page: number;
  page_size: number;
};
export type MerchantReviewSelection = {
  filter: MerchantReviewFilter;
  ordering: MerchantReviewOrdering;
};
