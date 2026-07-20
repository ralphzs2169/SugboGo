import { setTokens, clearTokens } from "@/shared/api/storage";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import { useAuthStore } from "../storage/auth.store";

/**
 * Establishes a user session by storing tokens and fetching the current user.
 * @param {Object} authData - The authentication data containing access and refresh tokens.
 * @param {string} authData.access - The access token.
 * @param {string} authData.refresh - The refresh token.
 */
export async function establishSession(authData) {
  setTokens({
    access: authData.access,
    refresh: authData.refresh,
  });

  const user = await getCurrentUser();

  useAuthStore.getState().setUser(user);
}

export function logout() {
  clearTokens();
  useAuthStore.getState().clearUser();
}
