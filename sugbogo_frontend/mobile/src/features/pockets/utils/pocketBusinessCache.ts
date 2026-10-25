import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { OPEN_NOW_BUSINESSES_QUERY_KEY } from "@/features/explore/constants/exploreHomepageQueries";

import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { DISCOVERY_RESULTS_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";
import { MAP_PREVIEW_QUERY_KEY } from "@/features/explore/hooks/useMapPreviewBusinesses";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "@/features/explore/hooks/useSimilarBusinesses";
import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "@/features/explore/types/exploreBusiness.types";

type CachedBusinesses =
  | ExploreBusiness
  | ExploreBusiness[]
  | ExploreBusinessListResponse
  | InfiniteData<ExploreBusinessListResponse>;

const prefixes = [
  ["explore-business-detail"],
  ["explore-new-businesses"],
  OPEN_NOW_BUSINESSES_QUERY_KEY,
  DISCOVERY_FEED_QUERY_KEY,
  DISCOVERY_RESULTS_QUERY_KEY,
  EXPLORE_COLLECTIONS_QUERY_KEY,
  MAP_PREVIEW_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  SIMILAR_BUSINESSES_QUERY_KEY,
];

/** Cancels stale reads before a confirmed saved flag is applied. */
export function cancelPocketBusinessReads(client: QueryClient) {
  return Promise.all(
    prefixes.map((queryKey) => client.cancelQueries({ queryKey })),
  );
}

/** Keeps populated feeds in place while restarting canceled active initial reads. */
export function invalidatePocketBusinessCaches(client: QueryClient) {
  return Promise.all(
    prefixes.flatMap((queryKey) => [
      client.invalidateQueries({ queryKey, refetchType: "none" }),
      client.refetchQueries(
        {
          queryKey,
          type: "active",
          predicate: (query) =>
            query.state.data === undefined &&
            query.state.status === "pending" &&
            query.state.fetchStatus === "idle",
        },
        { cancelRefetch: false },
      ),
    ]),
  );
}

/** Collection deletion returns no business flags, so reload active business displays. */
export function refreshPocketBusinessCaches(client: QueryClient) {
  return Promise.all(
    prefixes.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}

/** Patches only existing saved flags; never inserts, removes, ranks, or changes counts. */
export function updatePocketBusinessCaches(
  client: QueryClient,
  businessId: number,
  isPocketed: boolean,
) {
  const patchBusiness = (business: ExploreBusiness) =>
    business.id === businessId && typeof business.is_pocketed === "boolean"
      ? { ...business, is_pocketed: isPocketed }
      : business;
  const patchPage = (page: ExploreBusinessListResponse) => ({
    ...page,
    items: page.items.map(patchBusiness),
  });
  for (const queryKey of prefixes) {
    client.setQueriesData<CachedBusinesses>({ queryKey }, (current) => {
      if (!current) return current;
      if (Array.isArray(current)) return current.map(patchBusiness);
      if ("pages" in current)
        return { ...current, pages: current.pages.map(patchPage) };
      if ("items" in current) return patchPage(current);
      return patchBusiness(current);
    });
  }
}
