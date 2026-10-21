import { useQueryClient } from "@tanstack/react-query";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { invalidateAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getRefreshToken,
} from "@/shared/api/storage.service";
import { revokeRefreshToken } from "../api/token.service";
import { useAuthStore } from "../store/auth.store";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { clearSavedJourneysForLogout } from "@/features/offline-routes/services/savedJourneys.service";
import Toast from "react-native-toast-message";

/**
 * Handles user logout.
 *
 * Captures the refresh token for best-effort server revocation, removes local
 * credentials, clears server-state cache, and resets authentication state.
 */
export function useLogout() {
  const clearUser = useAuthStore((state) => state.clearUser);
  const queryClient = useQueryClient();

  async function logout() {
    const refreshToken = getRefreshToken();
    const guidanceCleanup = clearSavedJourneysForLogout().then(
      () => true,
      () => {
        Toast.show({
          type: "error",
          text1: "Saved guidance could not be removed",
          text2:
            "Local access is revoked. Sign in again to remove the device copies.",
        });
        return false;
      },
    );
    const cleanupGeneration = invalidateAuthSession();

    clearUser();
    useAppModeStore.getState().resetActiveMode();
    queryClient.clear();
    useMerchantRegistrationStore.getState().reset();

    // Capture the old token before cleanup; unavailable servers never block local logout.
    void refreshToken
      .then((token) => (token ? revokeRefreshToken(token) : undefined))
      .catch(() => undefined);

    try {
      const [, removedSavedGuidance] = await Promise.all([
        clearSessionTokens(cleanupGeneration),
        guidanceCleanup,
      ]);

      return removedSavedGuidance;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    }
  }

  return {
    logout,
  };
}
