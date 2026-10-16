import { useEffect, useRef } from "react";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import { getCurrentUser } from "../api/auth.service";
import { useAuthStore } from "../store/auth.store";

/**
 * Restores the user's authentication session when the application starts.
 *
 * Checks for an existing access token in secure storage, validates the token
 * by fetching the current user, and updates the global authentication state.
 */
export function useRestoreSession() {
  const hasRestored = useRef(false);

  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (hasRestored.current) return;

    hasRestored.current = true;

    async function restoreSession() {
      let restoreGeneration: number | null = null;

      try {
        const token = await getAccessToken();

        if (!token) {
          clearUser();
          useAppModeStore.getState().resetActiveMode();
          return;
        }

        restoreGeneration = beginAuthSession();
        useAppModeStore.getState().resetActiveMode();

        const user = await getCurrentUser();

        if (isAuthSessionCurrent(restoreGeneration)) {
          setUser(user);
        }
      } catch (error) {
        console.error(" Session restore failed:", error);

        if (
          restoreGeneration === null ||
          isAuthSessionCurrent(restoreGeneration)
        ) {
          const cleanupGeneration = invalidateAuthSession();

          clearUser();
          useAppModeStore.getState().resetActiveMode();
          await clearSessionTokens(cleanupGeneration);
        }
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [clearUser, setLoading, setUser]);
}
