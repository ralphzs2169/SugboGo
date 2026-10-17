import { create } from "zustand";

/** Holds local guidance access only; this state never authenticates API requests. */
export const useOfflineAccessStore = create<{
  ownerId: number | null;
  isRevoking: boolean;
  setOwnerId: (ownerId: number | null) => void;
  setRevoking: (isRevoking: boolean) => void;
}>((set) => ({
  ownerId: null,
  isRevoking: false,
  setOwnerId: (ownerId) => set({ ownerId }),
  setRevoking: (isRevoking) => set({ isRevoking }),
}));
