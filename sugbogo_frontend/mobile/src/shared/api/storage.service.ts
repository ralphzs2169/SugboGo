import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { clearOfflineAccess } from "@/features/offline-routes/services/offlineAccess.service";

import {
  isAuthSessionCurrent,
  isAuthSessionGenerationCurrent,
} from "./authSessionGeneration.service";

/**
 * Secure token storage utilities for authentication.
 *
 * This module provides helper functions for securely storing, retrieving,
 * and removing JWT access and refresh tokens using Expo SecureStore.
 */

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const INSTALLATION_ID_KEY = "installation_id";

let tokenMutationQueue: Promise<void> = Promise.resolve();
let installationIdInitialization: Promise<string> | null = null;

function enqueueTokenMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = tokenMutationQueue.then(mutation, mutation);

  tokenMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

export async function saveAccessToken(token: string) {
  await enqueueTokenMutation(() =>
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  );
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveRefreshToken(token: string) {
  await enqueueTokenMutation(() =>
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  );
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await Promise.all([
    clearOfflineAccess(),
    enqueueTokenMutation(async () => {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }),
  ]);
}

/**
 * Persists a token pair only while the initiating authentication session is
 * still current. Token mutations are serialized so a later logout or login
 * always wins even when SecureStore operations complete out of order.
 */
export function saveSessionTokens(
  accessToken: string,
  refreshToken: string | undefined,
  generation: number,
) {
  return enqueueTokenMutation(async () => {
    if (!isAuthSessionCurrent(generation)) {
      return false;
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

    if (!isAuthSessionCurrent(generation)) {
      return false;
    }

    if (refreshToken !== undefined) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }

    return isAuthSessionCurrent(generation);
  });
}

/** Clears credentials only if the requested session cleanup is still current. */
export async function clearSessionTokens(generation: number) {
  if (!isAuthSessionGenerationCurrent(generation)) {
    return false;
  }

  // Revoke immediately so delayed cleanup cannot revoke a newer login.
  const offlineCleanup = clearOfflineAccess();
  const tokenCleanup = enqueueTokenMutation(async () => {
    if (!isAuthSessionGenerationCurrent(generation)) {
      return false;
    }

    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);

    if (!isAuthSessionGenerationCurrent(generation)) {
      return false;
    }

    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);

    return isAuthSessionGenerationCurrent(generation);
  });

  const [, didClear] = await Promise.all([offlineCleanup, tokenCleanup]);
  return didClear;
}

/**
 * Retrieves the persistent app installation identifier used for abuse detection.
 *
 * A new identifier is generated only when one does not already exist.
 * The identifier is intentionally independent of the authenticated user
 * so it remains stable across login sessions.
 *
 * The identifier is stored in SecureStore and may change if the app is
 * uninstalled or its secure app data is removed.
 */
export async function getInstallationId() {
  if (installationIdInitialization === null) {
    installationIdInitialization = (async () => {
      const existingInstallationId =
        await SecureStore.getItemAsync(INSTALLATION_ID_KEY);

      if (existingInstallationId) {
        return existingInstallationId;
      }

      const installationId = randomUUID();

      await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);

      return installationId;
    })().finally(() => {
      // Share pending work only; retries must read the persisted source of truth.
      installationIdInitialization = null;
    });
  }

  return installationIdInitialization;
}

/**
 * Development helper.
 * Removes only the refresh token.
 */
export async function clearRefreshToken() {
  await enqueueTokenMutation(() =>
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  );
}
