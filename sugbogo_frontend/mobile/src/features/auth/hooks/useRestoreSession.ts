import { useEffect, useRef } from "react";

import { getCurrentUser } from "../api/auth.service";
import { getAccessToken, clearTokens } from "@/shared/api/storage.service";
import { useAuthStore } from "../store/auth.store";
import { isTransportError } from "@/shared/utils/isTransportError";
import {
  clearOfflineAccess,
  getOfflineOwner,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

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
      try {
        const token = await getAccessToken();

        if (!token) {
          clearUser();
          await clearOfflineAccess();
          return;
        }

        const user = await getCurrentUser();

        setUser(user);
        useOfflineAccessStore.getState().setOwnerId(null);
        useOfflineAccessStore.getState().setRevoking(false);
      } catch (error) {
        clearUser();
        if (isTransportError(error)) {
          // Local guidance access does not restore authentication or enable protected routes.
          const ownerId = await getOfflineOwner().catch(() => null);
          useOfflineAccessStore.getState().setOwnerId(ownerId);
        } else {
          await clearTokens();
        }
      } finally {
        setLoading(false);
      }
    }

    void restoreSession().catch(() => {
      clearUser();
      useOfflineAccessStore.getState().setOwnerId(null);
    });
  }, [clearUser, setLoading, setUser]);
}
