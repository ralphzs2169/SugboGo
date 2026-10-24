import { useAuthStore } from "@/features/auth/store/auth.store";
import { getOfflineOwner } from "@/features/offline-routes/services/offlineAccess.service";
import {
  useOfflineAccessStore,
  type RecentExploreGrant,
} from "@/features/offline-routes/stores/offlineAccess.store";
import {
  isAuthSessionGenerationCurrent,
  isOfflineTransportSession,
} from "@/shared/api/authSessionGeneration.service";
import { queryPersistence } from "@/shared/query/queryPersistence.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";
import type {
  ExploreBusinessListResponse,
  RecommendationBusinessListResponse,
} from "../types/exploreBusiness.types";
import {
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export type RecentExploreFeed = {
  key: string;
  title: string;
  fetchedAt: number;
  expiresAt: number;
  items: (
    ExploreBusinessListResponse | RecommendationBusinessListResponse
  )["items"];
};
const feeds = [
  { key: DISCOVERY_FEED_QUERY_KEY[0], title: "Hidden Gems" },
  { key: NEW_BUSINESSES_QUERY_KEY[0], title: "New to SugboGo" },
  { key: RECOMMENDATIONS_QUERY_KEY[0], title: "Based on your interests" },
];

/** Runtime grants come only from startup transport failure, never from stored JSON alone. */
export function isRecentExploreCurrent(grant: RecentExploreGrant) {
  const current = useOfflineAccessStore.getState().recentExplore;
  return (
    !useAuthStore.getState().isAuthenticated &&
    current === grant &&
    !useOfflineAccessStore.getState().isRevoking &&
    isAuthSessionGenerationCurrent(grant.generation) &&
    grant.apiScope === getQueryPersistenceApiScope()
  );
}

export async function readRecentExploreFeeds(
  grant: RecentExploreGrant,
  current = () => isRecentExploreCurrent(grant),
): Promise<RecentExploreFeed[]> {
  const entries = await queryPersistence.readLocal(grant, current);
  if (!current()) return [];
  return feeds.flatMap((feed) => {
    const entry = entries.find(
      (item) => item.queryKey.length === 1 && item.queryKey[0] === feed.key,
    );
    const data = entry?.data as ExploreBusinessListResponse | undefined;
    return entry && data?.items.length
      ? [
          {
            ...feed,
            items: data.items,
            fetchedAt: entry.fetchedAt,
            expiresAt: entry.fetchedAt + EXPLORE_HOMEPAGE_RETENTION_MS,
          },
        ]
      : [];
  });
}

/** Called only after startup's transport-failure branch has withdrawn API authority. */
export async function restoreRecentExploreAccess(generation: number) {
  const ownerId = await getOfflineOwner().catch(() => null);
  if (!ownerId) return null;
  const grant = {
    ownerId,
    apiScope: getQueryPersistenceApiScope(),
    generation,
  };
  const current = () =>
    isOfflineTransportSession(generation) &&
    !useAuthStore.getState().isAuthenticated &&
    !useOfflineAccessStore.getState().isRevoking &&
    grant.apiScope === getQueryPersistenceApiScope();
  if (!current()) return null;
  const entries = await readRecentExploreFeeds(grant, current);
  return current() && entries.length > 0 ? grant : null;
}
