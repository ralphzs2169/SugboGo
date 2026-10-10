import type { QueryClient } from "@tanstack/react-query";

import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { DISCOVERY_RESULTS_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "@/features/explore/hooks/useSimilarBusinesses";

const BUSINESS_IMAGE_COLLECTION_KEYS = [
  DISCOVERY_FEED_QUERY_KEY,
  DISCOVERY_RESULTS_QUERY_KEY,
  EXPLORE_COLLECTIONS_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  SIMILAR_BUSINESSES_QUERY_KEY,
  ["explore-new-businesses"] as const,
] as const;

/** Refresh Explorer collections whose business cards display a cover image. */
export function invalidateBusinessDisplayCover(queryClient: QueryClient) {
  return Promise.all(
    BUSINESS_IMAGE_COLLECTION_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
