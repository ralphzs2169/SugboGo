import { useAuthStore } from "@/features/auth/store/auth.store";
import { getOfflineOwner } from "@/features/offline-routes/services/offlineAccess.service";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
  type RecentExploreGrant,
} from "@/features/offline-routes/stores/offlineAccess.store";
import {
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
  { key: RECOMMENDATIONS_QUERY_KEY[0], title: "Explore local picks" },
];

export { isRecentExploreCurrent };

export function hasCachedExploreFeed(
  entries: Awaited<ReturnType<typeof queryPersistence.readLocal>>,
) {
  return feeds.some((feed) =>
    entries.some((entry) => {
      if (entry.queryKey[0] !== feed.key) return false;
      const data = entry.data as ExploreBusinessListResponse;
      return entry.queryKey.length === 1 && data.items.length > 0;
    }),
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
            title:
              feed.key === RECOMMENDATIONS_QUERY_KEY[0] &&
              (data as RecommendationBusinessListResponse).is_personalized ===
                true
                ? "For You"
                : feed.title,
            items: data.items,
            fetchedAt: entry.fetchedAt,
            expiresAt: entry.expiresAt,
          },
        ]
      : [];
  });
}

/** Checks local Explore after retryable session validation has withdrawn API authority. */
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
  const entries = await queryPersistence.readLocal(grant, current);
  return current() && hasCachedExploreFeed(entries) ? grant : null;
}
