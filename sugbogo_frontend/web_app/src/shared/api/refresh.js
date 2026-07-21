import authClient from "./authClient";
import { getRefreshToken, setTokens } from "./storage";

/**
 * Refreshes the user session by obtaining a new access token using the refresh token.
 * If the refresh token is not available, an error is thrown.
 * If the refresh is successful, the new access token is stored and returned.
 *
 * @returns {Promise<string>} The new access token.
 */
export async function refreshSession() {
  const refresh = getRefreshToken();

  if (!refresh) {
    throw new Error("No refresh token available.");
  }

  const response = await authClient.post("/auth/refresh/", {
    refresh,
  });

  setTokens({
    access: response.data.access,
    refresh: response.data.refresh ?? refresh,
  });

  return response.data.access;
}
