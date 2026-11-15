import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
  type RecentExploreGrant,
} from "@/features/offline-routes/stores/offlineAccess.store";
import { queryPersistence } from "@/shared/query/queryPersistence.service";

import { EXPLORE_HOMEPAGE_PERSISTENCE_POLICIES } from "../persistence/exploreHomepagePolicies";
import { hasCachedExploreFeed } from "../services/recentExplore.service";

/** Hydrates the normal Explore query keys from a current local grant. */
export default function useOfflineExploreCache(grant: RecentExploreGrant | null) {
  const client = useQueryClient();

  useEffect(() => {
    if (!grant) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const current = (access: RecentExploreGrant) =>
      !cancelled && isRecentExploreCurrent(access);

    async function hydrate(access: RecentExploreGrant) {
      const entries = await queryPersistence.readLocal(
        access,
        () => current(access),
      );
      if (!current(access)) return;

      const now = Date.now();
      const eligible = entries.filter((entry) => entry.expiresAt > now);

      for (const policy of EXPLORE_HOMEPAGE_PERSISTENCE_POLICIES) {
        const entry = eligible.find((item) => policy.matches(item.queryKey, access));
        if (entry) {
          client.setQueryData(entry.queryKey, entry.data, {
            updatedAt: entry.fetchedAt,
          });
        } else {
          // Active, disabled observers need to see the data disappear on expiry.
          client.getQueryCache().find({ queryKey: [policy.id] })?.reset();
        }
      }

      if (!hasCachedExploreFeed(eligible)) {
        useOfflineAccessStore.getState().setRecentExplore(null);
        return;
      }

      const nextExpiry = Math.min(...eligible.map((entry) => entry.expiresAt));
      timeout = setTimeout(() => void hydrate(access), Math.max(1, nextExpiry - now));
    }

    void hydrate(grant);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [client, grant]);
}
