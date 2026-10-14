import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  OFFLINE_API_SCOPE,
  OFFLINE_OWNER_KEY,
} from "../constants/offlineRoutes.constants";
import { useOfflineAccessStore } from "../stores/offlineAccess.store";

let accessQueue: Promise<unknown> = Promise.resolve();

/** Serializes marker changes so a pending save cannot regrant access after logout. */
function serializeAccess<T>(action: () => Promise<T>): Promise<T> {
  const result = accessQueue.then(action);
  accessQueue = result.catch(() => undefined);
  return result;
}

/** Records local-only ownership after an authenticated user explicitly saves guidance. */
export function rememberOfflineOwner(ownerId: number): Promise<void> {
  return serializeAccess(async () => {
    const auth = useAuthStore.getState();
    if (
      !auth.isAuthenticated ||
      auth.user?.id !== ownerId ||
      useOfflineAccessStore.getState().isRevoking
    ) {
      throw new Error("Sign in again before saving guidance.");
    }
    await SecureStore.setItemAsync(
      OFFLINE_OWNER_KEY,
      JSON.stringify({
        version: 1,
        ownerId,
        apiScope: OFFLINE_API_SCOPE,
      }),
    );
  });
}

/** Reads a minimal local owner marker without trusting it as an authenticated session. */
export async function getOfflineOwner(): Promise<number | null> {
  const value = await SecureStore.getItemAsync(OFFLINE_OWNER_KEY);
  if (!value) return null;
  try {
    const marker = JSON.parse(value);
    return marker.version === 1 &&
      marker.apiScope === OFFLINE_API_SCOPE &&
      Number.isSafeInteger(marker.ownerId) &&
      marker.ownerId > 0
      ? marker.ownerId
      : null;
  } catch {
    return null;
  }
}

/** Revokes local access immediately and removes its persisted marker in operation order. */
export function clearOfflineAccess(): Promise<void> {
  useOfflineAccessStore.getState().setOwnerId(null);
  useOfflineAccessStore.getState().setRevoking(true);
  return serializeAccess(() => SecureStore.deleteItemAsync(OFFLINE_OWNER_KEY));
}
