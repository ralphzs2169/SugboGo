import { refreshAccessToken } from "@/features/auth/api/token.service";
import {
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "./storage.service";

// Tracks an in-flight refresh so concurrent 401s share one request
// instead of each independently calling the refresh endpoint.
let inFlightRefresh: Promise<string> | null = null;

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
export async function refreshSession(): Promise<string> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await refreshAccessToken(refreshToken);

      await saveAccessToken(response.access);

      if (response.refresh) {
        await saveRefreshToken(response.refresh);
      }

      return response.access;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}
