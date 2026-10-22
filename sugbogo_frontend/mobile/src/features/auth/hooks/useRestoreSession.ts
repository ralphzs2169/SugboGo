import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";

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
  const [attempt, setAttempt] = useState(0);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const restoredAttempt = useRef(-1);

  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (restoredAttempt.current === attempt) return;

    restoredAttempt.current = attempt;

    async function restoreSession() {
      // Claim startup before reading storage so a later login or logout wins.
      const restoreGeneration = beginAuthSession();
      let hasStoredToken = false;

      try {
        const token = await getAccessToken();
        hasStoredToken = Boolean(token);

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
        }
      } catch (error) {
        if (!isAuthSessionCurrent(restoreGeneration)) {
          return;
        }

        const cleanupGeneration = invalidateAuthSession();
        clearUser();
        useAppModeStore.getState().resetActiveMode();

        const authenticationRejected =
          (error instanceof Error && error.name === "AUTH_ERROR") ||
          (isAxiosError(error) &&
            (error.response?.status === 401 || error.response?.status === 403));

        if (!authenticationRejected) {
          // Local guidance access never authenticates protected routes.
          // Keep the existing offline boundary; HTTP/server errors do not grant it.
          const ownerId =
            hasStoredToken && isTransportError(error)
              ? await getOfflineOwner().catch(() => null)
              : null;

          if (isAuthSessionGenerationCurrent(cleanupGeneration)) {
            useOfflineAccessStore.getState().setOwnerId(ownerId);
            setRecoveryRequired(true);
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
  }, [attempt, clearUser, setLoading, setUser]);

  const retry = useCallback(() => {
    setRecoveryRequired(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, [setLoading]);

  return {
    recoveryRequired,
    retry,
    continueWithoutSession: () => setRecoveryRequired(false),
  };
}
