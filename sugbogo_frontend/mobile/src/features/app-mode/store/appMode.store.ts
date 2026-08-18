import { create } from "zustand";

export type AppMode = "explorer" | "merchant";

type AppModeState = {
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
};

/**
 * Stores the user's currently active SugboGo experience.
 *
 * Authentication and mode are intentionally separate concerns:
 * authentication determines whether the user can access the app,
 * while this store determines whether they are using Explorer or Merchant.
 */
export const useAppModeStore = create<AppModeState>((set) => ({
  activeMode: "explorer",

  setActiveMode: (mode) =>
    set({
      activeMode: mode,
    }),
}));
