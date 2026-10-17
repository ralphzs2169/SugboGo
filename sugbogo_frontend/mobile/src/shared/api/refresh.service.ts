import { refreshAccessToken } from "@/features/auth/api/token.service";
import {
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  StaleAuthSessionError,
} from "./authSessionGeneration.service";
import { getRefreshToken, saveSessionTokens } from "./storage.service";

// Tracks an in-flight refresh so concurrent 401s share one request
// instead of each independently calling the refresh endpoint.
type InFlightRefresh = {
  generation: number;
  promise: Promise<string>;
};

let inFlightRefresh: InFlightRefresh | null = null;

/**
 * Refreshes the user's access token using the stored refresh token.
 *
 * Saves the newly issued tokens after successful refresh. If a refresh
 * is already in progress, callers await that same request instead of
 * triggering a duplicate one — this prevents a race where multiple
 * 401s at the same time each try to use the same refresh token, causing
 * every refresh after the first to fail against a backend that rotates
 * (invalidates) refresh tokens on use.
 */
export async function refreshSession(
  generation = getAuthSessionGeneration(),
): Promise<string> {
  assertAuthSessionCurrent(generation);

  if (inFlightRefresh?.generation === generation) {
    return inFlightRefresh.promise;
  }

  const operation = (async () => {
    try {
      const refreshToken = await getRefreshToken();

      assertAuthSessionCurrent(generation);

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await refreshAccessToken(refreshToken);

      assertAuthSessionCurrent(generation);

      const didPersist = await saveSessionTokens(
        response.access,
        response.refresh,
        generation,
      );

      if (!didPersist) {
        throw new StaleAuthSessionError();
      }

      assertAuthSessionCurrent(generation);

      return response.access;
    } catch (error) {
      if (!isAuthSessionCurrent(generation)) {
        throw new StaleAuthSessionError();
      }

      throw error;
    }
  })();

  const refresh = { generation, promise: operation };
  inFlightRefresh = refresh;

  try {
    return await operation;
  } finally {
    if (inFlightRefresh === refresh) {
      inFlightRefresh = null;
    }
  }
}
