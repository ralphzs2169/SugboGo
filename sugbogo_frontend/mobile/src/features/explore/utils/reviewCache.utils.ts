import type { QueryClient } from "@tanstack/react-query";

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
