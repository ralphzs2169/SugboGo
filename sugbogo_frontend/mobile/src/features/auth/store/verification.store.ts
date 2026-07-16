import { create } from "zustand";
import { persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// This store manages the state related to email verification, specifically the
// pending email address that requires verification. It provides methods to
// set and clear the pending email, and persists this state using AsyncStorage
// for consistency across app sessions.

interface VerificationState {
  pendingEmail: string | null;

  setPendingEmail: (email: string) => void;

  clearPendingEmail: () => void;
}

// The verification store is created using Zustand with persistence enabled.
export const useVerificationStore = create<VerificationState>()(
  persist(
    (set) => ({
      pendingEmail: null,
      createdAt: null,

      setPendingEmail: (email) =>
        set({
          pendingEmail: email,
        }),

      clearPendingEmail: () =>
        set({
          pendingEmail: null,
        }),
    }),
    {
      name: "verification-storage",

      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },

        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },

        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
    },
  ),
);
