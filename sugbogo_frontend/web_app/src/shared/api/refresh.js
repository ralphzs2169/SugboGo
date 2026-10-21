import authClient from "./authClient";
import { getRefreshToken, getSessionGeneration, setTokens } from "./storage";

// Tracks an in-flight refresh so concurrent 401s share one request
// instead of each independently calling the refresh endpoint.
let inFlightRefresh = null;

/**
 * Refreshes the user session by obtaining a new access token using the refresh token.
 * If the refresh token is not available, an error is thrown.
 * If the refresh is successful, the new access token is stored and returned.
 *
 * If a refresh is already in progress, callers await that same request
 * instead of triggering a duplicate one — this prevents a race where
 * multiple 401s at the same time each try to use the same refresh
 * token, causing every refresh after the first to fail against a
 * backend that rotates (invalidates) refresh tokens on use.
 *
 * @returns {Promise<string>} The new access token.
 */
export async function refreshSession() {
  const generation = getSessionGeneration();
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new Error("No refresh token available.");
  }
  if (inFlightRefresh?.generation === generation) {
    return inFlightRefresh.promise;
  }

  const operation = (async () => {
    try {
      const response = await authClient.post("/auth/refresh/", {
        refresh,
      });
      if (getSessionGeneration() !== generation || getRefreshToken() !== refresh) {
        throw staleSessionError();
      }
      if (typeof response.data.access !== "string" || !response.data.access) {
        throw new Error("Invalid refresh response.");
      }

      setTokens({
        access: response.data.access,
        refresh: response.data.refresh ?? refresh,
      }, { preserveSession: true });

      return response.data.access;
    } catch (error) {
      if (getSessionGeneration() !== generation || getRefreshToken() !== refresh) throw staleSessionError();
      throw error;
    }
  })();
  inFlightRefresh = { generation, promise: operation };
  try {
    return await operation;
  } finally {
    if (inFlightRefresh?.promise === operation) inFlightRefresh = null;
  }
}

/** Identifies obsolete refresh work without expiring a newer account session. */
export function staleSessionError() {
  const error = new Error("Authentication session changed.");
  error.name = "STALE_AUTH_SESSION";
  return error;
}
