import type { QueryClient } from "@tanstack/react-query";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import {
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  OPEN_NOW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
} from "@/features/explore/constants/exploreHomepageQueries";
import { DISCOVERY_RESULTS_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "@/features/explore/hooks/useSimilarBusinesses";
import {
  MAP_DIRECTORY_QUERY_KEY,
  MAP_BUSINESS_QUERY_KEY,
  mapBusinessQueryKey,
} from "@/features/map/hooks/mapDirectoryQueryKeys";
import { pocketCollectionsQueryKey } from "@/features/pockets/hooks/pocketQueryKeys";

const publicPrefixes = new Set<string>([
  DISCOVERY_FEED_QUERY_KEY[0],
  NEW_BUSINESSES_QUERY_KEY[0],
  OPEN_NOW_BUSINESSES_QUERY_KEY[0],
  RECOMMENDATIONS_QUERY_KEY[0],
  DISCOVERY_RESULTS_QUERY_KEY[0],
  EXPLORE_COLLECTIONS_QUERY_KEY[0],
  SIMILAR_BUSINESSES_QUERY_KEY[0],
  MAP_DIRECTORY_QUERY_KEY[0],
  "explore-business-detail",
]);
/** Read only business-list envelopes and entity identities, never route or taxonomy children. */
function idsIn(data: unknown): number[] {
  if (Array.isArray(data)) return data.flatMap(idsIn);
  if (!data || typeof data !== "object") return [];
  if ("pages" in data) return idsIn(data.pages);
  if ("items" in data) return idsIn(data.items);
  if ("businesses" in data) return idsIn(data.businesses);
  if ("id" in data && typeof data.id === "number") return [data.id];
  return [];
}
/** Include recent cached discovery identities even when none was explicitly downloaded. */
export function cachedBusinessIds(client: QueryClient) {
  return client
    .getQueryCache()
    .getAll()
    .flatMap((query) =>
      publicPrefixes.has(String(query.queryKey[0]))
        ? idsIn(query.state.data)
        : [],
    );
}
/** Refetch only business-bearing caches affected by confirmed changes; never reset Explorer globally. */
export function refreshAvailabilityCaches(
  client: QueryClient,
  ownerId: number,
  changedIds: number[],
) {
  if (!changedIds.length) return Promise.resolve([]);
  const ids = new Set(changedIds);
  return Promise.all([
    ...changedIds.flatMap((id) => [
      client.invalidateQueries({ queryKey: exploreBusinessDetailKey(id) }),
      client.invalidateQueries({ queryKey: mapBusinessQueryKey(id) }),
    ]),
    client.invalidateQueries({
      predicate: (query) =>
        publicPrefixes.has(String(query.queryKey[0])) &&
        query.queryKey[0] !== "explore-business-detail" &&
        !(
          query.queryKey[0] === MAP_BUSINESS_QUERY_KEY[0] &&
          query.queryKey[1] === MAP_BUSINESS_QUERY_KEY[1]
        ) &&
        idsIn(query.state.data).some((id) => ids.has(id)),
    }),
    client.invalidateQueries({ queryKey: pocketCollectionsQueryKey(ownerId) }),
  ]);
}
