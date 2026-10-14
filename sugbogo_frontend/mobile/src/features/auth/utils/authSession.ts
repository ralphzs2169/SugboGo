import { AuthResponse } from "../types/auth.types";
import {
  saveAccessToken,
  saveRefreshToken,
} from "@/shared/api/storage.service";
import { useAuthStore } from "../store/auth.store";
import { clearOfflineAccess } from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

/**
 * Persists an authenticated session.
 *
 * Saves the issued JWT tokens to secure storage and updates the global
 * authentication state with the authenticated user.
 */
export async function establishSession(response: AuthResponse): Promise<void> {
  await clearOfflineAccess();
  await saveAccessToken(response.access);
  await saveRefreshToken(response.refresh);

  useAuthStore.getState().setUser(response.user);
  useOfflineAccessStore.getState().setRevoking(false);
}
