import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { restoreRecentExploreAccess } from "@/features/explore/services/recentExplore.service";
import {
  clearOfflineAccess,
  getRestorableOfflineOwner,
  rememberOfflineResources,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  beginAuthSession,
  invalidateAuthSession,
  suspendAuthSession,
  isAuthSessionCurrent,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import { queryClient } from "@/shared/query/queryClient";
import { isTransportError } from "@/shared/utils/isTransportError";
import { getCurrentUser } from "../api/auth.service";
import { useAuthStore } from "../store/auth.store";

/** Shared startup/reconnect validation. Local data never establishes API authentication. */
export async function restoreSession() {
  const restoreGeneration = beginAuthSession("restore");
  try {
    const token = await getAccessToken();
    if (!isAuthSessionCurrent(restoreGeneration)) return "stale";
    if (!token) {
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
      useAppModeStore.getState().resetActiveMode();
      await clearOfflineAccess();
      return "denied";
    }
    useAppModeStore.getState().resetActiveMode();
    const user = await getCurrentUser();
    if (!isAuthSessionCurrent(restoreGeneration)) return "stale";
    // Fresh identity validation is required; never carry another owner's memory.
    queryClient.clear();
    useAuthStore.getState().setUser(user);
    useOfflineAccessStore.getState().setOwnerId(null);
    useOfflineAccessStore.getState().setRecentExplore(null);
    useOfflineAccessStore.getState().setRevoking(false);
    void rememberOfflineResources(user.id, restoreGeneration).catch(
      () => undefined,
    );
    return "authenticated";
  } catch (error) {
    if (!isAuthSessionCurrent(restoreGeneration)) return "stale";
    const transport = isTransportError(error);
    const cleanupGeneration = transport
      ? suspendAuthSession()
      : invalidateAuthSession();
    useAuthStore.getState().clearUser();
    queryClient.clear();
    useAppModeStore.getState().resetActiveMode();
    if (transport) {
      const [ownerId, recent] = await Promise.all([
        getRestorableOfflineOwner(cleanupGeneration).catch(() => null),
        restoreRecentExploreAccess(cleanupGeneration).catch(() => null),
      ]);
      if (isAuthSessionGenerationCurrent(cleanupGeneration)) {
        useOfflineAccessStore.getState().setOwnerId(ownerId);
        useOfflineAccessStore.getState().setRecentExplore(recent);
      }
      return "offline";
    } else {
      useOfflineAccessStore.getState().setOwnerId(null);
      await clearSessionTokens(cleanupGeneration);
      return "denied";
    }
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}
