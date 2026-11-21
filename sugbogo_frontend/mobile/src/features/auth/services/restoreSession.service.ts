import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { restoreRecentExploreAccess } from "@/features/explore/services/recentExplore.service";
import {
  clearOfflineAccess,
  getRestorableOfflineOwner,
  rememberOfflineResources,
} from "@/features/offline-routes/services/offlineAccess.service";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
} from "@/features/offline-routes/stores/offlineAccess.store";
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
import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import { queryClient } from "@/shared/query/queryClient";
import { isTransportError } from "@/shared/utils/isTransportError";
import { getCurrentUser } from "../api/auth.service";
import { useAuthStore } from "../store/auth.store";
import { isAxiosError } from "axios";

/** Shared startup/reconnect validation. Local data never establishes API authentication. */
export async function restoreSession() {
  const grant = useOfflineAccessStore.getState().recentExplore;
  const cachedOwnerId =
    grant && isRecentExploreCurrent(grant) ? grant.ownerId : null;
  const restoreGeneration = beginAuthSession("restore");
  let hasStoredToken = false;

  try {
    const token = await getAccessToken();
    hasStoredToken = Boolean(token);
    if (!isAuthSessionCurrent(restoreGeneration)) {
      return "stale";
    }
    if (!token) {
      const cleanupGeneration = invalidateAuthSession();
      useAuthStore.getState().clearUser();
      queryClient.clear();
      useAppModeStore.getState().resetActiveMode();
      await clearOfflineAccess();
      return isAuthSessionGenerationCurrent(cleanupGeneration)
        ? "denied"
        : "stale";
    }
    useAppModeStore.getState().resetActiveMode();
    const user = await getCurrentUser();
    if (!isAuthSessionCurrent(restoreGeneration)) {
      return "stale";
    }
    // Preserve the hydrated Explore cache only for the verified local owner.
    const currentGrant = useOfflineAccessStore.getState().recentExplore;
    if (
      cachedOwnerId !== user.id ||
      !currentGrant ||
      currentGrant.ownerId !== cachedOwnerId ||
      !isRecentExploreCurrent(currentGrant)
    ) {
      queryClient.clear();
    }
    useAuthStore.getState().setUser(user);
    useOfflineAccessStore.setState({
      ownerId: null,
      recentExplore: null,
      sessionSuspended: false,
      isRevoking: false,
    });
    void rememberOfflineResources(user.id, restoreGeneration).catch(
      () => undefined,
    );
    return "authenticated";
  } catch (error) {
    if (!isAuthSessionCurrent(restoreGeneration)) {
      return "stale";
    }
    const transport = hasStoredToken && isTransportError(error);
    const authenticationRejected =
      (error instanceof Error && error.name === API_ERROR_CODE.AUTH_ERROR) ||
      (isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403));
    const cleanupGeneration = transport
      ? suspendAuthSession()
      : invalidateAuthSession();
    useAuthStore.getState().clearUser();
    if (!transport || cachedOwnerId === null) {
      queryClient.clear();
    }
    useAppModeStore.getState().resetActiveMode();
    if (transport) {
      const [owner, recent] = await Promise.allSettled([
        getRestorableOfflineOwner(cleanupGeneration),
        restoreRecentExploreAccess(cleanupGeneration),
      ]);
      if (!isAuthSessionGenerationCurrent(cleanupGeneration)) {
        return "stale";
      }
      const ownerId = owner.status === "fulfilled" ? owner.value : null;
      const recentGrant = recent.status === "fulfilled" ? recent.value : null;
      if (
        cachedOwnerId !== null &&
        (recentGrant?.ownerId !== cachedOwnerId ||
          recentGrant.apiScope !== grant?.apiScope)
      ) {
        queryClient.clear();
      }
      useOfflineAccessStore.setState({
        ownerId,
        recentExplore: recentGrant,
      });
      return "offline";
    }
    useOfflineAccessStore.getState().setOwnerId(null);
    if (!authenticationRejected) {
      return "recovery";
    }
    useAuthStore.getState().setSessionExpired(true);
    await clearSessionTokens(cleanupGeneration);
    return isAuthSessionGenerationCurrent(cleanupGeneration)
      ? "denied"
      : "stale";
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}
