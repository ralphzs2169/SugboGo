import apiClient from "@/shared/api/apiClient";
import { RefreshResponse } from "./auth.types";

/**
 * Requests a new access token using a refresh token.
 *
 * @param refreshToken - The stored JWT refresh token.
 * @returns Newly generated JWT tokens.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>("/auth/refresh/", {
    refresh: refreshToken,
  });

  return response.data;
}
