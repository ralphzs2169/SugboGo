import { refreshAccessToken } from "@/features/auth/api/token.service";
import {
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "./storage.service";

/**
 * Refreshes the user's access token using the stored refresh token.
 *
 * Saves the newly issued tokens after successful refresh.
 *
 */
export async function refreshSession() {
  const refreshToken = await getRefreshToken();

  console.log("🔑 REFRESH TOKEN FOUND:", refreshToken ? "YES" : "NO");

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  console.log("🔄 CALLING REFRESH ENDPOINT");
  const response = await refreshAccessToken(refreshToken);

  console.log("🟢 REFRESH RESPONSE:", {
    hasAccessToken: !!response.access,
    hasRefreshToken: !!response.refresh,
  });

  await saveAccessToken(response.access);

  if (response.refresh) {
    console.log("💾 SAVING NEW REFRESH TOKEN");
    await saveRefreshToken(response.refresh);
  }

  return response.access;
}
