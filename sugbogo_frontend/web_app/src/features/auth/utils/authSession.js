import { setTokens, clearTokens, getRefreshToken, getSessionGeneration } from "@/shared/api/storage";
import { getCurrentUser, revokeRefreshToken } from "@/features/auth/api/auth.service";
import { useAuthStore } from "../storage/auth.store";
import { staleSessionError } from "@/shared/api/refresh";

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
  const generation = getSessionGeneration();

  try {
    const user = await getCurrentUser();
    if (generation !== getSessionGeneration()) {
      throw staleSessionError();
    }
    useAuthStore.getState().setUser(user);
  } catch (error) {
    if (generation !== getSessionGeneration()) {
      throw staleSessionError();
    }
    throw error;
  } finally {
    if (generation === getSessionGeneration()) {
      useAuthStore.getState().setLoading(false);
    }
  }
}

/** Clears local authentication immediately and attempts server revocation in the background. */
export function logout() {
  const refresh = getRefreshToken();
  clearTokens();
  useAuthStore.getState().clearUser();
  if (refresh) {
    void revokeRefreshToken(refresh).catch(() => undefined);
  }
}
