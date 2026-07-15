import { AuthResponse } from "../api/auth.types";
import { saveAccessToken, saveRefreshToken } from "@/shared/api/storage";
import { useAuthStore } from "../store/auth.store";

/**
 * Persists an authenticated session.
 *
 * Saves the issued JWT tokens to secure storage and updates the global
 * authentication state with the authenticated user.
 *
 * @param {AuthResponse} response - The successful authentication response.
 */
export async function establishSession(response: AuthResponse): Promise<void> {
  await saveAccessToken(response.access);
  await saveRefreshToken(response.refresh);

  useAuthStore.getState().setUser(response.user);
}
