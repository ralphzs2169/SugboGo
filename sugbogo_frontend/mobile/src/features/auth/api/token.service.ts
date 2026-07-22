import authClient from "@/shared/api/authClient";
import { RefreshResponse } from "./auth.types";

/**
 * Refreshes the user's access token using the provided refresh token.
 * @param refreshToken The refresh token to use for obtaining a new access token.
 * @returns The new access token and optionally a new refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await authClient.post<RefreshResponse>("/auth/refresh/", {
    refresh: refreshToken,
  });

  return response.data;
}
