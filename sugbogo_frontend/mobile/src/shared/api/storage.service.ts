import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";

/**
 * Secure token storage utilities for authentication.
 *
 * This module provides helper functions for securely storing, retrieving,
 * and removing JWT access and refresh tokens using Expo SecureStore.
 */

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const INSTALLATION_ID_KEY = "installation_id";

export async function saveAccessToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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
  const existingInstallationId =
    await SecureStore.getItemAsync(INSTALLATION_ID_KEY);

  if (existingInstallationId) {
    return existingInstallationId;
  }

  const installationId = randomUUID();

  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);

  return installationId;
}

/**
 * Development helper.
 * Removes only the refresh token.
 */
export async function clearRefreshToken() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
