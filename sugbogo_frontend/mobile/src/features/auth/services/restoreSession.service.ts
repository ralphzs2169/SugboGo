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

/** Converts a server retry hint to an absolute deadline. */
function getRetryAfterDeadline(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const now = Date.now();
  const seconds = Number(value);
  const deadline = Number.isFinite(seconds)
    ? now + seconds * 1_000
    : Date.parse(String(value));
  return Number.isFinite(deadline) && deadline > now ? deadline : null;
}

/** Shared startup/reconnect validation. Local data never establishes API authentication. */
export async function restoreSession() {
  const { recentExplore: grant, sessionSuspended } =
    useOfflineAccessStore.getState();
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
      retrySessionAfter: null,
      reconnectRefreshGeneration: sessionSuspended ? restoreGeneration : null,
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
    const response = isAxiosError(error) ? error.response : undefined;
    const status = response?.status;
    const retryable =
      hasStoredToken &&
      (isTransportError(error) ||
        status === 429 ||
        (status !== undefined && status >= 500 && status < 600));
    const authenticationRejected =
      (error instanceof Error && error.name === API_ERROR_CODE.AUTH_ERROR) ||
      status === 401 ||
      status === 403;
    const cleanupGeneration = retryable
      ? suspendAuthSession()
      : invalidateAuthSession();
    useAuthStore.getState().clearUser();
    if (!retryable || cachedOwnerId === null) {
      queryClient.clear();
    }
    useAppModeStore.getState().resetActiveMode();
    if (retryable) {
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
        retrySessionAfter: getRetryAfterDeadline(response?.headers?.["retry-after"]),
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
