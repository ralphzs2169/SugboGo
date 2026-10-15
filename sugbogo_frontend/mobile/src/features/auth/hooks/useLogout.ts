import { useQueryClient } from "@tanstack/react-query";

import { clearTokens } from "@/shared/api/storage.service";
import { useAuthStore } from "../store/auth.store";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { clearOfflineAccess } from "@/features/offline-routes/services/offlineAccess.service";
import { clearSavedJourneys } from "@/features/offline-routes/services/savedJourneys.service";
import Toast from "react-native-toast-message";

/**
 * Handles user logout.
 *
 * Removes stored authentication tokens, clears server-state cache,
 * and resets the global authentication state.
 */
export function useLogout() {
  const clearUser = useAuthStore((state) => state.clearUser);
  const queryClient = useQueryClient();

  async function logout() {
    const ownerId = useAuthStore.getState().user?.id;
    let removedSavedGuidance = true;
    try {
      await clearOfflineAccess();
      if (ownerId) {
        try {
          await clearSavedJourneys(ownerId);
        } catch {
          // Logout still revokes access when device storage cleanup fails.
          removedSavedGuidance = false;
          Toast.show({
            type: "error",
            text1: "Saved guidance could not be removed",
            text2:
              "Local access is revoked. Sign in again to remove the device copies.",
          });
        }
      }
      await clearTokens();

      useMerchantRegistrationStore.getState().reset();

      return removedSavedGuidance;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    } finally {
      queryClient.clear();
      clearUser();
    }
  }

  return {
    logout,
  };
}
