import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import type { CommunityReviewListResponse } from "@/features/community/types/communityReview.types";
import type {
  BusinessReview,
  BusinessReviewListResponse,
  BusinessReviewPreview,
} from "../types/review.types";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "../hooks/reviewQueryKeys";

import { DISCOVERY_FEED_QUERY_KEY } from "../hooks/useDiscoveryFeed";
import { DISCOVERY_RESULTS_QUERY_KEY } from "../hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "../hooks/useExploreCollection";
import { MAP_PREVIEW_QUERY_KEY } from "../hooks/useMapPreviewBusinesses";
import { RECOMMENDATIONS_QUERY_KEY } from "../hooks/useRecommendations";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "../hooks/useSimilarBusinesses";

const BUSINESS_CARD_COLLECTION_QUERY_KEYS = [
  DISCOVERY_FEED_QUERY_KEY,
  ["explore-new-businesses"] as const,
  RECOMMENDATIONS_QUERY_KEY,
  DISCOVERY_RESULTS_QUERY_KEY,
  SIMILAR_BUSINESSES_QUERY_KEY,
  EXPLORE_COLLECTIONS_QUERY_KEY,
  MAP_PREVIEW_QUERY_KEY,
] as const;

/** Refreshes existing business-card collections after counts or vibe change. */
export function invalidateBusinessCardCollections(queryClient: QueryClient) {
  return Promise.all(
    BUSINESS_CARD_COLLECTION_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

/** Removes confirmed-deleted content without inventing counts or derived values. */
export function removeDeletedReviewFromPublicCaches(
  queryClient: QueryClient,
  businessId: number,
  reviewId: number,
) {
  queryClient.setQueryData<BusinessReviewPreview>(
    businessReviewPreviewKey(businessId),
    (current) => {
      if (!current) return current;
      return {
        ...current,
        reviews: current.reviews.filter((review) => review.id !== reviewId),
        user_review:
          current.user_review?.id === reviewId ? null : current.user_review,
      };
    },
  );
  queryClient.setQueriesData<
    | InfiniteData<BusinessReviewListResponse>
    | { reviews: BusinessReview[]; totalCount: number }
  >({ queryKey: businessReviewsKey(businessId) }, (current) => {
    if (!current) return current;
    if ("pages" in current) {
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((review) => review.id !== reviewId),
        })),
      };
    }
    return {
      ...current,
      reviews: current.reviews.filter((review) => review.id !== reviewId),
    };
  });
  queryClient.setQueriesData<InfiniteData<CommunityReviewListResponse>>(
    { queryKey: COMMUNITY_REVIEWS_QUERY_KEY },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((review) => review.id !== reviewId),
        })),
      };
    },
  );
}
