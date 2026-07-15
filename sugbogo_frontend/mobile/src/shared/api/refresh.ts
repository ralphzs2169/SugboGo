import { refreshAccessToken } from "@/features/auth/api/token.service";
import { getRefreshToken, saveAccessToken, saveRefreshToken } from "./storage";

/**
 * Refreshes the user's access token using the stored refresh token.
 *
 * Saves the newly issued tokens after successful refresh.
 *
 * @returns The new access token.
 */
export async function refreshSession() {
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
}
