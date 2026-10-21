import { AuthResponse } from "../types/auth.types";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  isAuthSessionCurrent,
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
 * authentication state with the authenticated user.
 */
export async function establishSession(response: AuthResponse): Promise<void> {
  const generation = beginAuthSession();

  queryClient.clear();
  useAuthStore.getState().clearUser();
  useAppModeStore.getState().resetActiveMode();

  try {
    await clearOfflineAccess();

    const didPersist = await saveSessionTokens(
      response.access,
      response.refresh,
      generation,
    );

    if (!didPersist || !isAuthSessionCurrent(generation)) {
      throw new StaleAuthSessionError();
    }

    useAuthStore.getState().setUser(response.user);
    useOfflineAccessStore.getState().setRevoking(false);
    void rememberOfflineResources(response.user.id, generation).catch(
      () => undefined,
    );
  } catch (error) {
    if (isAuthSessionCurrent(generation)) {
      const cleanupGeneration = invalidateAuthSession();

      useAuthStore.getState().clearUser();
      useAppModeStore.getState().resetActiveMode();

      try {
        await clearSessionTokens(cleanupGeneration);
      } catch {
        // Preserve the original authentication or SecureStore error.
      }
    }

    throw error;
  }
}
