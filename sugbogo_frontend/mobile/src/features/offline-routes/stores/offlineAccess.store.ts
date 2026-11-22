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

/** Holds local access and suspended-session state without granting API authentication. */
export const useOfflineAccessStore = create<{
  ownerId: number | null;
  isRevoking: boolean;
  sessionSuspended: boolean;
  retrySessionAfter: number | null;
  reconnectRequest: number;
  requestReconnect: () => void;
  reconnectRefreshGeneration: number | null;
  recentExplore: RecentExploreGrant | null;
  setRecentExplore: (grant: RecentExploreGrant | null) => void;
  setOwnerId: (ownerId: number | null) => void;
  setRevoking: (isRevoking: boolean) => void;
}>((set) => ({
  ownerId: null,
  isRevoking: false,
  sessionSuspended: false,
  retrySessionAfter: null,
  reconnectRequest: 0,
  requestReconnect: () => set((state) => ({ reconnectRequest: state.reconnectRequest + 1 })),
  reconnectRefreshGeneration: null,
  recentExplore: null,
  setRecentExplore: (recentExplore) => set({ recentExplore }),
  setOwnerId: (ownerId) => set({ ownerId }),
  setRevoking: (isRevoking) => set({ isRevoking }),
}));

subscribeAuthSessionChanges((change) => {
  if (change === "restore" || change === "offline") {
    useOfflineAccessStore.setState((state) => ({
      sessionSuspended: change === "offline" || state.sessionSuspended,
      reconnectRefreshGeneration: null,
      recentExplore: state.recentExplore && {
        ...state.recentExplore,
        generation: getAuthSessionGeneration(),
      },
    }));
  } else {
    useOfflineAccessStore.setState({
      sessionSuspended: false,
      retrySessionAfter: null,
      reconnectRefreshGeneration: null,
      recentExplore: null,
    });
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
