import { useAuthStore } from "@/features/auth/store/auth.store";
import { create } from "zustand";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";

export type RecentExploreGrant = {
  ownerId: number;
  apiScope: string;
  generation: number;
};

/** Holds local guidance access only; this state never authenticates API requests. */
export const useOfflineAccessStore = create<{
  ownerId: number | null;
  isRevoking: boolean;
  recentExplore: RecentExploreGrant | null;
  setRecentExplore: (grant: RecentExploreGrant | null) => void;
  setOwnerId: (ownerId: number | null) => void;
  setRevoking: (isRevoking: boolean) => void;
}>((set) => ({
  ownerId: null,
  isRevoking: false,
  recentExplore: null,
  setRecentExplore: (recentExplore) => set({ recentExplore }),
  setOwnerId: (ownerId) => set({ ownerId }),
  setRevoking: (isRevoking) => set({ isRevoking }),
}));

subscribeAuthSessionChanges((change) => {
  const store = useOfflineAccessStore.getState();
  if (change === "restore" || change === "offline") {
    if (store.recentExplore)
      store.setRecentExplore({
        ...store.recentExplore,
        generation: getAuthSessionGeneration(),
      });
  } else {
    store.setRecentExplore(null);
  }
});

/** Verifies the in-memory grant against the current account boundary. */
export function isRecentExploreCurrent(grant: RecentExploreGrant) {
  const access = useOfflineAccessStore.getState();
  return (
    !useAuthStore.getState().isAuthenticated &&
    access.recentExplore === grant &&
    !access.isRevoking &&
    isAuthSessionGenerationCurrent(grant.generation) &&
    grant.apiScope === getQueryPersistenceApiScope()
  );
}
