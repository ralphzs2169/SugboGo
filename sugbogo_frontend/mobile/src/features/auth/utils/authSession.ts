import { AuthResponse } from "../types/auth.types";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  isAuthSessionCurrent,
  isAuthSessionGenerationCurrent,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  saveSessionTokens,
} from "@/shared/api/storage.service";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "../store/auth.store";
import {
  clearOfflineAccess,
  rememberOfflineResources,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

/**
 * Persists an authenticated session.
 *
 * Saves the issued JWT tokens to secure storage and updates the global
 * authentication state with the authenticated user. Returns the installed
 * generation so callers can discard stale navigation.
 */
export async function establishSession(
  response: AuthResponse,
  canInstall?: () => boolean,
): Promise<number> {
  if (canInstall && !canInstall()) {
    throw new StaleAuthSessionError();
  }

  const generation = beginAuthSession();

  queryClient.clear();
  useAuthStore.getState().clearUser();
  useAppModeStore.getState().resetActiveMode();

  try {
    await clearOfflineAccess();
    if (!isAuthSessionCurrent(generation) || (canInstall && !canInstall())) {
      throw new StaleAuthSessionError();
    }

    const didPersist = await saveSessionTokens(
      response.access,
      response.refresh,
      generation,
    );

    if (
      !didPersist ||
      !isAuthSessionCurrent(generation) ||
      (canInstall && !canInstall())
    ) {
      throw new StaleAuthSessionError();
    }

    useAuthStore.getState().setUser(response.user);
    useOfflineAccessStore.getState().setRevoking(false);
    void rememberOfflineResources(response.user.id, generation).catch(
      () => undefined,
    );
    return generation;
  } catch (error) {
    if (!isAuthSessionCurrent(generation)) {
      throw new StaleAuthSessionError();
    }

    const cleanupGeneration = invalidateAuthSession();

    useAuthStore.getState().clearUser();
    useAppModeStore.getState().resetActiveMode();

    try {
      await clearSessionTokens(cleanupGeneration);
    } catch {
      // Preserve the original authentication or SecureStore error.
    }

    if (!isAuthSessionGenerationCurrent(cleanupGeneration)) {
      throw new StaleAuthSessionError();
    }

    throw error;
  }
}
