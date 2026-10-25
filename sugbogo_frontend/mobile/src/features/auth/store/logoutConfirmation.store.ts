import { create } from "zustand";

type LogoutConfirmationState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

/** Keeps the shared logout dialog independent of authenticated route lifetimes. */
export const useLogoutConfirmationStore = create<LogoutConfirmationState>(
  (set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }),
);
