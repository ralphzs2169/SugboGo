import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
} from "../types/communityReview.types";

export const COMMUNITY_REVIEWS_QUERY_KEY = ["community-reviews"] as const;

/** Identifies one independently cached set of server-side feed filters. */
export function communityReviewsKey(
  filters: CommunityReviewFilters = DEFAULT_COMMUNITY_REVIEW_FILTERS,
) {
  return [
    ...COMMUNITY_REVIEWS_QUERY_KEY,
    {
      ordering: filters.ordering,
      clusterId: filters.clusterId,
      hasPhotos: filters.hasPhotos,
    },
  ] as const;
}
