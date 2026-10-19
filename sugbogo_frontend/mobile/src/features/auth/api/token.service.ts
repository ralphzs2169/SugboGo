import authClient from "@/shared/api/authClient.service";
import { RefreshResponse } from "../types/auth.types";

/**
 * Refreshes the user's access token using the provided refresh token.
 * @param refreshToken The refresh token to use for obtaining a new access token.
 * @returns The new access token and optionally a new refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await authClient.post<RefreshResponse>(
    "/auth/refresh/",
    {
      refresh: refreshToken,
    },
    {
      validateStatus: (status) => status >= 200 && status < 300,
    },
  );

  if (typeof response.data.access !== "string" || !response.data.access) {
    throw new Error("Invalid refresh response");
  }

  return response.data;
}

/** Requests server refresh revocation without using or refreshing an access token. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await authClient.post(
    "/auth/logout/",
    { refresh: refreshToken },
    {
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 300,
    },
  );
}
