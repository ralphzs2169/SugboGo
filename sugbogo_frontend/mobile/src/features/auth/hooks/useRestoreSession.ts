import { useEffect, useRef } from "react";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  isAuthSessionCurrent,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import { getCurrentUser } from "../api/auth.service";
import { useAuthStore } from "../store/auth.store";
import { isTransportError } from "@/shared/utils/isTransportError";
import {
  clearOfflineAccess,
  getRestorableOfflineOwner,
  rememberOfflineResources,
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
      // Claim startup before reading storage so a later login or logout wins.
      const restoreGeneration = beginAuthSession("restore");

      try {
        const token = await getAccessToken();

        if (!isAuthSessionCurrent(restoreGeneration)) {
          return;
        }

        if (!token) {
          invalidateAuthSession();
          clearUser();
          useAppModeStore.getState().resetActiveMode();
          await clearOfflineAccess();
          return;
        }

        useAppModeStore.getState().resetActiveMode();
        const user = await getCurrentUser();

        if (isAuthSessionCurrent(restoreGeneration)) {
          setUser(user);
          useOfflineAccessStore.getState().setOwnerId(null);
          useOfflineAccessStore.getState().setRevoking(false);
          void rememberOfflineResources(user.id, restoreGeneration).catch(
            () => undefined,
          );
        }
      } catch (error) {
        if (!isAuthSessionCurrent(restoreGeneration)) {
          return;
        }

        const cleanupGeneration = invalidateAuthSession();
        clearUser();
        useAppModeStore.getState().resetActiveMode();

        if (isTransportError(error)) {
          // A validated local resource grants browsing only, never protected routes.
          const ownerId = await getRestorableOfflineOwner(
            cleanupGeneration,
          ).catch(() => null);

          if (isAuthSessionGenerationCurrent(cleanupGeneration)) {
            useOfflineAccessStore.getState().setOwnerId(ownerId);
          }
        } else {
          await clearSessionTokens(cleanupGeneration);
        }
      } finally {
        setLoading(false);
      }
    }

    void restoreSession().catch(() => {
      // Runtime state was revoked before cleanup; never clear a newer session.
    });
  }, [clearUser, setLoading, setUser]);
}
