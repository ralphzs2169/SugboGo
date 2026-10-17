import { useQueryClient } from "@tanstack/react-query";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { invalidateAuthSession } from "@/shared/api/authSessionGeneration.service";
import { clearSessionTokens } from "@/shared/api/storage.service";
import { useAuthStore } from "../store/auth.store";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
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
    const cleanupGeneration = invalidateAuthSession();

    clearUser();
    useAppModeStore.getState().resetActiveMode();
    queryClient.clear();
    useMerchantRegistrationStore.getState().reset();

    try {
      await Promise.all([
        clearSessionTokens(cleanupGeneration),
        (async () => {
          if (ownerId) {
            try {
              await clearSavedJourneys(ownerId);
            } catch {
              removedSavedGuidance = false;
              Toast.show({
                type: "error",
                text1: "Saved guidance could not be removed",
                text2:
                  "Local access is revoked. Sign in again to remove the device copies.",
              });
            }
          }
        })(),
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
