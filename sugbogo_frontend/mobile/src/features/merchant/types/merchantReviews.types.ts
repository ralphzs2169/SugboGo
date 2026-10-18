export type MerchantReviewFilter = "all" | "needs-reply" | "replied";
export type MerchantReviewOrdering = "newest" | "oldest";
export type MerchantReviewSelection = {
  filter: MerchantReviewFilter;
  ordering: MerchantReviewOrdering;
};
