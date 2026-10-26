import type { QueryClient } from "@tanstack/react-query";

import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { DISCOVERY_RESULTS_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "@/features/explore/hooks/useSimilarBusinesses";
import {
  MAP_DIRECTORY_DATA_QUERY_KEY,
  MAP_BUSINESS_QUERY_KEY,
  mapBusinessQueryKey,
} from "@/features/map/hooks/mapDirectoryQueryKeys";

const BUSINESS_IMAGE_COLLECTION_KEYS = [
  DISCOVERY_FEED_QUERY_KEY,
  DISCOVERY_RESULTS_QUERY_KEY,
  EXPLORE_COLLECTIONS_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  SIMILAR_BUSINESSES_QUERY_KEY,
  ["explore-new-businesses"] as const,
  // The shared directory embeds covers for Map business previews.
  MAP_DIRECTORY_DATA_QUERY_KEY,
] as const;

/** Refresh business-image collections and the affected compact Map preview. */
export function invalidateBusinessDisplayCover(
  queryClient: QueryClient,
  businessId?: number,
) {
  // Older/unknown-ID callers cannot identify one compact entry safely.
  const compactKey =
    businessId === undefined
      ? MAP_BUSINESS_QUERY_KEY
      : mapBusinessQueryKey(businessId);
  return Promise.all([
    ...BUSINESS_IMAGE_COLLECTION_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
    queryClient.invalidateQueries({ queryKey: compactKey }),
  ]);
}
