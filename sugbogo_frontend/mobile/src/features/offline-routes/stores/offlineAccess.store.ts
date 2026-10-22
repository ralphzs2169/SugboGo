import { create } from "zustand";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

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
