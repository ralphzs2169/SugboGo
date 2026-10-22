import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";

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
export function rememberOfflineOwner(
  ownerId: number,
  generation = getAuthSessionGeneration(),
): Promise<void> {
  return serializeAccess(async () => {
    const auth = useAuthStore.getState();
    if (
      !auth.isAuthenticated ||
      auth.user?.id !== ownerId ||
      !isAuthSessionGenerationCurrent(generation) ||
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

/** Authorizes resource-existence probes only; it never exposes data or grants authentication. */
export async function assertOfflineResourceOwner(
  ownerId: number,
  generation: number,
): Promise<void> {
  const auth = useAuthStore.getState();
  const markerOwner = auth.isAuthenticated
    ? auth.user?.id
    : await getOfflineOwner();
  if (
    !Number.isSafeInteger(ownerId) ||
    ownerId <= 0 ||
    markerOwner !== ownerId ||
    useOfflineAccessStore.getState().isRevoking ||
    !isAuthSessionGenerationCurrent(generation)
  ) {
    throw new Error("Offline data is unavailable for this session.");
  }
}

/** Accepts only a persisted scoped owner with at least one usable local resource. */
export async function getRestorableOfflineOwner(
  generation: number,
): Promise<number | null> {
  const ownerId = await getOfflineOwner();
  if (!ownerId) return null;
  const resources = await hasOfflineResources(ownerId, generation);
  await assertOfflineResourceOwner(ownerId, generation);
  return resources ? ownerId : null;
}

async function hasOfflineResources(
  ownerId: number,
  generation: number,
): Promise<boolean> {
  /* eslint-disable @typescript-eslint/no-require-imports -- Lazy lookup avoids repository ownership import cycles. */
  const journeys =
    require("./savedJourneys.service") as typeof import("./savedJourneys.service");
  const businesses =
    require("@/features/offline-pockets/services/offlinePockets.service") as typeof import("@/features/offline-pockets/services/offlinePockets.service");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const results = await Promise.allSettled([
    journeys.hasSavedJourneysForOfflineAccess(ownerId, generation),
    businesses.hasBusinessSnapshotsForOfflineAccess(ownerId, generation),
  ]);
  if (results.some((result) => result.status === "fulfilled" && result.value))
    return true;
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Unable to verify offline data on this device.");
  }
  return false;
}

/** Restores a marker for retained resources after an explicitly authenticated sign-in. */
export async function rememberOfflineResources(
  ownerId: number,
  generation: number,
): Promise<void> {
  await assertOfflineResourceOwner(ownerId, generation);
  if (await hasOfflineResources(ownerId, generation)) {
    await rememberOfflineOwner(ownerId, generation);
  }
}

/** Removes an empty grant without blocking future authenticated saves, unlike explicit logout. */
export function releaseOfflineAccessIfEmpty(
  ownerId: number,
  generation: number,
): Promise<void> {
  return serializeAccess(async () => {
    await assertOfflineResourceOwner(ownerId, generation);
    if (await hasOfflineResources(ownerId, generation)) return;
    await assertOfflineResourceOwner(ownerId, generation);
    if (useOfflineAccessStore.getState().ownerId === ownerId) {
      useOfflineAccessStore.getState().setOwnerId(null);
    }
    await SecureStore.deleteItemAsync(OFFLINE_OWNER_KEY);
  });
}

/** Revokes local access immediately and removes its persisted marker in operation order. */
export function clearOfflineAccess(): Promise<void> {
  useOfflineAccessStore.getState().setOwnerId(null);
  useOfflineAccessStore.getState().setRevoking(true);
  return serializeAccess(() => SecureStore.deleteItemAsync(OFFLINE_OWNER_KEY));
}
